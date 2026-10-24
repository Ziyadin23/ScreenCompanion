#include "runtime.hpp"
#include <cwctype>
#include <cctype>
namespace sc {
HttpOperation::HttpOperation(std::string url, std::map<std::string, std::string> headers, Bytes body, int connectMs, int totalMs)
  : url_(Wide(url)), body_(std::move(body)), connectMs_(connectMs), totalMs_(totalMs), deadline_(std::chrono::steady_clock::now() + std::chrono::milliseconds(totalMs)) {
  for (const auto& [name, value] : headers) headers_ += Wide(name) + L": " + Wide(value) + L"\r\n";
}
HttpOperation::~HttpOperation() {
  Close(); Wipe(body_);
  if (!headers_.empty()) SecureZeroMemory(headers_.data(), headers_.size() * sizeof(wchar_t));
  if (!url_.empty()) SecureZeroMemory(url_.data(), url_.size() * sizeof(wchar_t));
}
void HttpOperation::Cancel() { std::lock_guard guard(mutex_); cancelled_ = true; changed_.notify_all(); }
void CALLBACK HttpOperation::Callback(HINTERNET, DWORD_PTR context, DWORD event, void* information, DWORD size) {
  if (!context) return;
  auto self = reinterpret_cast<HttpOperation*>(context);
  std::lock_guard guard(self->mutex_);
  if (event == WINHTTP_CALLBACK_STATUS_HANDLE_CLOSING) self->closed_ = true;
  else if (event == WINHTTP_CALLBACK_STATUS_REQUEST_ERROR) self->error_ = static_cast<WINHTTP_ASYNC_RESULT*>(information)->dwError;
  else if (event == WINHTTP_CALLBACK_STATUS_SENDREQUEST_COMPLETE || event == WINHTTP_CALLBACK_STATUS_HEADERS_AVAILABLE || event == WINHTTP_CALLBACK_STATUS_READ_COMPLETE) {
    self->event_ = event; if (event == WINHTTP_CALLBACK_STATUS_READ_COMPLETE) self->read_ = size;
  }
  self->changed_.notify_all();
}
void HttpOperation::Wait(DWORD expected) {
  std::unique_lock lock(mutex_);
  if (std::chrono::steady_clock::now() >= deadline_) throw std::runtime_error("The HTTP request exceeded its total deadline (Windows code 12002).");
  if (!changed_.wait_until(lock, deadline_, [&] { return cancelled_ || error_ || event_ == expected; })) throw std::runtime_error("The HTTP request exceeded its total deadline (Windows code 12002).");
  if (cancelled_) throw std::runtime_error("The HTTP request was cancelled (Windows code 12017).");
  if (error_) throw Failure("The HTTP request failed", error_);
  event_ = 0;
}
void HttpOperation::Close() {
  HINTERNET request = nullptr;
  { std::lock_guard guard(mutex_); request = request_; request_ = nullptr; }
  if (request) {
    WinHttpCloseHandle(request);
    if (callbackInstalled_) { std::unique_lock guard(mutex_); changed_.wait(guard, [&] { return closed_; }); }
  }
  if (connection_) { WinHttpCloseHandle(connection_); connection_ = nullptr; }
  if (session_) { WinHttpCloseHandle(session_); session_ = nullptr; }
}
void HttpOperation::Run() {
  try {
    { std::lock_guard guard(mutex_); if (cancelled_) throw std::runtime_error("The HTTP request was cancelled (Windows code 12017)."); }
    if (std::chrono::steady_clock::now() >= deadline_) throw std::runtime_error("The HTTP request exceeded its total deadline (Windows code 12002).");
    URL_COMPONENTS components {}; components.dwStructSize = sizeof(components);
    components.dwSchemeLength = components.dwHostNameLength = components.dwUrlPathLength = components.dwExtraInfoLength = static_cast<DWORD>(-1);
    if (!WinHttpCrackUrl(url_.c_str(), static_cast<DWORD>(url_.size()), 0, &components)) throw Failure("The HTTP URL is invalid");
    if (components.nScheme != INTERNET_SCHEME_HTTPS && components.nScheme != INTERNET_SCHEME_HTTP) throw std::runtime_error("The HTTP URL scheme is unsupported.");
    std::wstring host(components.lpszHostName, components.dwHostNameLength);
    std::wstring path(components.lpszUrlPath, components.dwUrlPathLength);
    if (path.empty()) path = L"/";
    if (components.dwExtraInfoLength) path.append(components.lpszExtraInfo, components.dwExtraInfoLength);
    // Automatic proxy uses system/per-user WinHTTP settings including PAC/WPAD. No TLS flags are weakened.
    session_ = WinHttpOpen(L"SC/0.5", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, WINHTTP_FLAG_ASYNC);
    if (!session_) throw Failure("The HTTP session could not be opened");
    if (!WinHttpSetTimeouts(session_, connectMs_, connectMs_, totalMs_, totalMs_)) throw Failure("The HTTP timeouts could not be configured");
    connection_ = WinHttpConnect(session_, host.c_str(), components.nPort, 0);
    if (!connection_) throw Failure("The HTTP connection could not be prepared");
    DWORD flags = components.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0;
    request_ = WinHttpOpenRequest(connection_, L"POST", path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
    if (!request_) throw Failure("The HTTP request could not be prepared");
    DWORD policy = WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
    if (!WinHttpSetOption(request_, WINHTTP_OPTION_REDIRECT_POLICY, &policy, sizeof(policy))) throw Failure("API redirect protection could not be configured");
    DWORD_PTR context = reinterpret_cast<DWORD_PTR>(this);
    if (!WinHttpSetOption(request_, WINHTTP_OPTION_CONTEXT_VALUE, &context, sizeof(context))) throw Failure("The HTTP callback context could not be configured");
    if (WinHttpSetStatusCallback(request_, Callback, WINHTTP_CALLBACK_FLAG_ALL_COMPLETIONS | WINHTTP_CALLBACK_FLAG_HANDLES, 0) == WINHTTP_INVALID_STATUS_CALLBACK) throw Failure("The HTTP callbacks could not be configured");
    callbackInstalled_ = true;
    if (!WinHttpSendRequest(request_, headers_.empty() ? WINHTTP_NO_ADDITIONAL_HEADERS : headers_.c_str(), static_cast<DWORD>(headers_.size()), body_.empty() ? WINHTTP_NO_REQUEST_DATA : body_.data(), static_cast<DWORD>(body_.size()), static_cast<DWORD>(body_.size()), context)) {
      DWORD error = GetLastError(); if (error != ERROR_IO_PENDING) throw Failure("The HTTP request could not be sent", error);
    }
    Wait(WINHTTP_CALLBACK_STATUS_SENDREQUEST_COMPLETE);
    if (!WinHttpReceiveResponse(request_, nullptr)) { DWORD error = GetLastError(); if (error != ERROR_IO_PENDING) throw Failure("The HTTP response could not be received", error); }
    Wait(WINHTTP_CALLBACK_STATUS_HEADERS_AVAILABLE);
    DWORD length = sizeof(result.status);
    if (!WinHttpQueryHeaders(request_, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &result.status, &length, WINHTTP_NO_HEADER_INDEX)) throw Failure("The HTTP status could not be read");
    length = 0;
    WinHttpQueryHeaders(request_, WINHTTP_QUERY_RAW_HEADERS_CRLF, WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &length, WINHTTP_NO_HEADER_INDEX);
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || length > 256 * 1024) throw std::runtime_error("The HTTP response headers are invalid or too large.");
    std::vector<wchar_t> headerBuffer(length / sizeof(wchar_t) + 1);
    if (!WinHttpQueryHeaders(request_, WINHTTP_QUERY_RAW_HEADERS_CRLF, WINHTTP_HEADER_NAME_BY_INDEX, headerBuffer.data(), &length, WINHTTP_NO_HEADER_INDEX)) throw Failure("The HTTP headers could not be read");
    std::wstring raw(headerBuffer.data());
    size_t position = raw.find(L"\r\n");
    while (position != std::wstring::npos) {
      size_t start = position + 2, end = raw.find(L"\r\n", start); if (end == std::wstring::npos || end == start) break;
      std::wstring line = raw.substr(start, end - start); size_t colon = line.find(L':');
      if (colon != std::wstring::npos) {
        std::wstring key = line.substr(0, colon), value = line.substr(colon + 1);
        std::transform(key.begin(), key.end(), key.begin(), [](wchar_t ch) { return static_cast<wchar_t>(towlower(ch)); });
        auto first = value.find_first_not_of(L" \t"); value = first == std::wstring::npos ? L"" : value.substr(first);
        result.headers[Utf8(key)] = Utf8(value);
      }
      position = end;
    }
    SecureZeroMemory(headerBuffer.data(), headerBuffer.size() * sizeof(wchar_t));
    SecureZeroMemory(raw.data(), raw.size() * sizeof(wchar_t));
    // Network sign-in/redirect responses are rejected by provider adapters from
    // their status/headers. Close now so an untrusted or stalled page body cannot
    // consume the request deadline or replace those useful diagnostics.
    auto contentType = result.headers.find("content-type");
    std::string media = contentType == result.headers.end() ? "" : contentType->second;
    std::transform(media.begin(), media.end(), media.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if ((result.status >= 300 && result.status < 400) || result.status == 407 || result.status == 511 ||
        media.find("text/html") != std::string::npos || media.find("application/xhtml+xml") != std::string::npos) {
      Wipe(body_); Close(); return;
    }
    Bytes chunk(64 * 1024);
    try {
      for (;;) {
        if (!WinHttpReadData(request_, chunk.data(), static_cast<DWORD>(chunk.size()), nullptr)) { DWORD error = GetLastError(); if (error != ERROR_IO_PENDING) throw Failure("The HTTP response body could not be read", error); }
        Wait(WINHTTP_CALLBACK_STATUS_READ_COMPLETE);
        if (!read_) break;
        if (result.body.size() + read_ > 64 * 1024 * 1024) throw std::runtime_error("The HTTP response exceeded the supported size.");
        result.body.insert(result.body.end(), chunk.begin(), chunk.begin() + read_);
        SecureZeroMemory(chunk.data(), chunk.size());
      }
    } catch (...) {
      // WinHTTP may still own the read buffer after a timeout/cancellation. Wait
      // for HANDLE_CLOSING before the buffer is wiped or its storage is freed.
      Close(); Wipe(chunk); throw;
    }
    Wipe(chunk); Wipe(body_); Close();
  } catch (...) { Close(); Wipe(body_); Wipe(result.body); throw; }
}
}
