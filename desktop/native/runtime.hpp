#pragma once
#include "common.hpp"
namespace sc {
struct Binding { int id; UINT modifiers; UINT key; bool operator==(const Binding&) const = default; };
struct Event { std::string type; int value = 0; };
class Runtime : public std::enable_shared_from_this<Runtime> {
 public:
  explicit Runtime(Napi::Env env, Napi::Function callback);
  ~Runtime();
  bool Acquire();
  void Apply(const std::vector<Binding>& bindings);
  void Attach(HWND panel);
  void Detach();
  void InputHeight(int height) { inputHeight_ = height; }
  void BeginDrag(HWND window, int edge);
  void StartProtection();
  std::string Protect(HWND window);
  std::string ProtectionStatus() const;
  uint64_t PrepareColor(HWND owner);
  std::string Choose(HWND owner, const std::string& initial, uint64_t generation);
  void CloseDialogs(HWND owner);
  void DialogsVisible(HWND owner, bool visible);
  void Stop();
  bool Stopped() const { return stopped_; }
  void Emit(const std::string& type, int value = 0);
 private:
  void Call(const std::function<void()>& operation);
  void Run(std::promise<void> ready);
  void InstallProtection(DWORD thread);
  void RemoveProtection(DWORD thread);
  static LRESULT CALLBACK WindowProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam);
  static LRESULT CALLBACK MouseProc(int code, WPARAM message, LPARAM data);
  static LRESULT CALLBACK ProtectionProc(int code, WPARAM wparam, LPARAM lparam);
  static UINT_PTR CALLBACK ColorProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam);
  LRESULT Mouse(int code, WPARAM message, LPARAM data);
  bool ConfigureDrag(HWND window, int edge, POINT pointer);
  Napi::ThreadSafeFunction callback_;
  std::thread thread_;
  DWORD threadId_ = 0;
  HWND messageWindow_ = nullptr;
  HWND panel_ = nullptr;
  HHOOK mouseHook_ = nullptr;
  HANDLE mutex_ = nullptr;
  bool ownsMutex_ = false;
  UINT activation_ = 0;
  std::wstring activationName_;
  std::map<int, Binding> shortcuts_;
  std::atomic<int> inputHeight_ {0};
  std::atomic<bool> stopped_ {false};
  std::atomic<bool> protectionStarted_ {false};
  std::atomic<int> protectionResult_ {0};
  std::mutex callMutex_;
  std::mutex hooksMutex_;
  std::map<DWORD, HHOOK> hooks_;
  std::mutex dialogsMutex_;
  std::condition_variable dialogsCv_;
  std::map<HWND, HWND> dialogs_;
  std::map<HWND, uint64_t> dialogGenerations_;
  std::set<HWND> hiddenDialogs_;
  std::set<HWND> hiddenOwners_;
  size_t colorWorkers_ = 0;
  struct Drag { HWND window = nullptr; bool intercepted = false; int edge = 0; POINT pointer {}; RECT rectangle {}; RECT workArea {}; int minWidth = 180; int minHeight = 80; } drag_;
};
struct HttpResult { DWORD status = 0; std::map<std::string, std::string> headers; Bytes body; ~HttpResult() { Wipe(body); } };
class HttpOperation {
 public:
  HttpOperation(std::string url, std::map<std::string, std::string> headers, Bytes body, int connectMs, int totalMs);
  ~HttpOperation();
  void Run();
  void Cancel();
  HttpResult result;
 private:
  static void CALLBACK Callback(HINTERNET, DWORD_PTR, DWORD, void*, DWORD);
  void Wait(DWORD expected);
  void Close();
  std::wstring url_;
  std::wstring headers_;
  Bytes body_;
  int connectMs_, totalMs_;
  std::chrono::steady_clock::time_point deadline_;
  std::mutex mutex_;
  std::condition_variable changed_;
  HINTERNET session_ = nullptr, connection_ = nullptr, request_ = nullptr;
  bool cancelled_ = false, closed_ = false, callbackInstalled_ = false;
  DWORD event_ = 0, error_ = 0, read_ = 0;
};
}
