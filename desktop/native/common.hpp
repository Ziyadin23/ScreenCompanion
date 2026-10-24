#pragma once
#ifndef _WIN32
#error SC native bridge requires Windows.
#endif
#include <napi.h>
#include <windows.h>
#include <winhttp.h>
#include <wincrypt.h>
#include <commdlg.h>
#include <objidl.h>
#include <gdiplus.h>
#include <sddl.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <functional>
#include <future>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace sc {
using Bytes = std::vector<unsigned char>;
inline void Wipe(Bytes& data) { if (!data.empty()) SecureZeroMemory(data.data(), data.size()); data.clear(); }
inline std::runtime_error Failure(const char* operation, DWORD code = GetLastError()) {
  return std::runtime_error(std::string(operation) + " (Windows code " + std::to_string(code) + ").");
}
inline std::wstring Wide(const std::string& input) {
  if (input.empty()) return {};
  int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), nullptr, 0);
  if (!size) throw Failure("Invalid UTF-8");
  std::wstring result(size, L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), result.data(), size);
  return result;
}
inline std::string Utf8(const std::wstring& input) {
  if (input.empty()) return {};
  int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), nullptr, 0, nullptr, nullptr);
  if (!size) throw Failure("Invalid Unicode");
  std::string result(size, '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), result.data(), size, nullptr, nullptr);
  return result;
}
inline HWND Handle(const Napi::Value& value) {
  if (!value.IsBuffer()) throw std::runtime_error("A native window handle is required.");
  auto buffer = value.As<Napi::Buffer<unsigned char>>();
  if (buffer.Length() != sizeof(HWND)) throw std::runtime_error("The window handle has an incompatible architecture.");
  HWND result = nullptr;
  memcpy(&result, buffer.Data(), sizeof(result));
  DWORD process = 0;
  if (!IsWindow(result) || !GetWindowThreadProcessId(result, &process) || process != GetCurrentProcessId())
    throw std::runtime_error("The window must belong to this SC process.");
  return result;
}
struct Bounds { int x, y, width, height; };
inline Napi::Object ToJs(Napi::Env env, Bounds bounds) {
  auto value = Napi::Object::New(env);
  value.Set("x", bounds.x); value.Set("y", bounds.y); value.Set("width", bounds.width); value.Set("height", bounds.height);
  return value;
}
inline Bounds ReadBounds(const Napi::Value& value) {
  auto o = value.As<Napi::Object>();
  Bounds b {o.Get("x").As<Napi::Number>().Int32Value(), o.Get("y").As<Napi::Number>().Int32Value(),
    o.Get("width").As<Napi::Number>().Int32Value(), o.Get("height").As<Napi::Number>().Int32Value()};
  if (b.width <= 0 || b.height <= 0 || b.width > 32768 || b.height > 32768 || static_cast<int64_t>(b.width) * b.height > 128 * 1024 * 1024)
    throw std::runtime_error("Windows did not report a usable monitor size.");
  return b;
}
struct Region { double x, y, width, height; };
struct SecretBytes { Bytes value; ~SecretBytes() { Wipe(value); } };
class Work final : public Napi::AsyncWorker {
 public:
  Work(Napi::Env env, std::function<void()> execute, std::function<Napi::Value(Napi::Env)> complete)
    : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)), execute_(std::move(execute)), complete_(std::move(complete)) {}
  Napi::Promise Start() { auto promise = deferred_.Promise(); Queue(); return promise; }
  void Execute() override { try { execute_(); } catch (const std::exception& error) { SetError(error.what()); } catch (...) { SetError("The Windows operation failed."); } }
  void OnOK() override {
    try { deferred_.Resolve(complete_(Env())); }
    catch (const std::exception&) { deferred_.Reject(Napi::Error::New(Env(), "The Windows result could not be returned.").Value()); }
  }
  void OnError(const Napi::Error& error) override { deferred_.Reject(error.Value()); }
 private:
  Napi::Promise::Deferred deferred_;
  std::function<void()> execute_;
  std::function<Napi::Value(Napi::Env)> complete_;
};
Bounds Monitor(HWND window, bool active);
Bytes Capture(Bounds bounds);
Bytes Crop(const Bytes& input, Region region);
Bytes Dpapi(const unsigned char* input, size_t length, bool protect);
}
