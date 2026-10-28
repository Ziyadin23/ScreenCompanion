#include "runtime.hpp"
#include <windowsx.h>
namespace sc {
namespace {
constexpr UINT COMMAND = WM_APP + 517;
thread_local Runtime* mouseRuntime = nullptr;
std::mutex protectionRegistryMutex;
std::map<DWORD, std::weak_ptr<Runtime>> protectionRegistry;
thread_local bool applyingProtection = false;
struct ColorContext { Runtime* self; HWND owner; uint64_t generation; };
void RecordProtection(std::atomic<int>& state, int result) {
  int previous = state.load();
  while (previous < result && !state.compare_exchange_weak(previous, result)) {}
}
int Affinity(HWND window) {
  using VersionFunction = LONG (WINAPI*)(OSVERSIONINFOW*);
  OSVERSIONINFOW version {}; version.dwOSVersionInfoSize = sizeof(version);
  auto versionFunction = reinterpret_cast<VersionFunction>(GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion"));
  bool exclude = versionFunction && versionFunction(&version) == 0 && (version.dwMajorVersion > 10 || (version.dwMajorVersion == 10 && version.dwBuildNumber >= 19041));
  DWORD requested = exclude ? 0x11 : 1;
  if (SetWindowDisplayAffinity(window, requested)) {
    DWORD actual = 0;
    if (GetWindowDisplayAffinity(window, &actual) && actual == requested) return exclude ? 0 : 1;
  }
  if (exclude && SetWindowDisplayAffinity(window, 1)) {
    DWORD actual = 0; if (GetWindowDisplayAffinity(window, &actual) && actual == 1) return 1;
  }
  return 2;
}
std::string Result(int result) { return result == 0 ? "Excluded" : result == 1 ? "ContentHidden" : "Failed"; }
std::wstring UserSid() {
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) throw Failure("The Windows user identity could not be opened");
  DWORD size = 0; GetTokenInformation(token, TokenUser, nullptr, 0, &size);
  Bytes bytes(size);
  if (!GetTokenInformation(token, TokenUser, bytes.data(), size, &size)) { DWORD error = GetLastError(); CloseHandle(token); throw Failure("The Windows user identity could not be read", error); }
  LPWSTR sid = nullptr;
  BOOL ok = ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(bytes.data())->User.Sid, &sid);
  DWORD code = GetLastError(); CloseHandle(token); Wipe(bytes);
  if (!ok) throw Failure("The Windows user identity could not be read", code);
  std::wstring result(sid); LocalFree(sid); return result;
}
bool ValidBinding(Binding binding) {
  UINT own = (binding.key == VK_CONTROL || binding.key == VK_LCONTROL || binding.key == VK_RCONTROL) ? MOD_CONTROL :
    (binding.key == VK_MENU || binding.key == VK_LMENU || binding.key == VK_RMENU) ? MOD_ALT :
    (binding.key == VK_SHIFT || binding.key == VK_LSHIFT || binding.key == VK_RSHIFT) ? MOD_SHIFT :
    (binding.key == VK_LWIN || binding.key == VK_RWIN) ? MOD_WIN : 0;
  return binding.id >= 1 && binding.id <= 6 && binding.key > 0 && binding.key < 65535 && binding.key != VK_F12 && binding.modifiers <= 15 && !(binding.modifiers & own);
}
}
Runtime::Runtime(Napi::Env env, Napi::Function callback) {
  callback_ = Napi::ThreadSafeFunction::New(env, callback, "SC native events", 0, 1);
  callback_.Unref(env);
  std::promise<void> ready;
  auto future = ready.get_future();
  thread_ = std::thread([this, ready = std::move(ready)]() mutable { Run(std::move(ready)); });
  try { future.get(); }
  catch (...) { if (thread_.joinable()) thread_.join(); callback_.Release(); throw; }
}
Runtime::~Runtime() { Stop(); }
void Runtime::Emit(const std::string& type, int value) {
  if (stopped_) return;
  auto event = new Event {type, value};
  napi_status status = callback_.NonBlockingCall(event, [](Napi::Env env, Napi::Function callback, Event* raw) {
    std::unique_ptr<Event> event(raw);
    if (!env || !callback) return;
    auto value = Napi::Object::New(env); value.Set("type", event->type);
    if (event->type == "action") {
      const char* actions[] = {"", "capture", "test", "visibility", "settings", "exit", "input"};
      if (event->value < 1 || event->value > 6) return;
      value.Set("action", actions[event->value]);
    } else if (event->type == "wheel") value.Set("delta", event->value);
    callback.Call({value});
  });
  if (status != napi_ok) delete event;
}
void Runtime::Run(std::promise<void> ready) {
  try {
    threadId_ = GetCurrentThreadId(); mouseRuntime = this;
    SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    static std::once_flag registered;
    std::call_once(registered, [] {
      WNDCLASSW klass {}; klass.lpfnWndProc = WindowProc; klass.hInstance = GetModuleHandleW(nullptr); klass.lpszClassName = L"SC.Electron.Native";
      if (!RegisterClassW(&klass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) throw Failure("SC could not create its native message class");
    });
    activation_ = RegisterWindowMessageW(L"SC.ActivateExistingInstance");
    if (!activation_) throw Failure("SC could not prepare its launch notification");
    messageWindow_ = CreateWindowExW(0, L"SC.Electron.Native", L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, GetModuleHandleW(nullptr), this);
    if (!messageWindow_) throw Failure("SC could not create its activation window");
    ready.set_value();
    MSG message {};
    while (GetMessageW(&message, nullptr, 0, 0) > 0) { TranslateMessage(&message); DispatchMessageW(&message); }
  } catch (...) { try { ready.set_exception(std::current_exception()); } catch (...) {} }
  if (mouseHook_) { UnhookWindowsHookEx(mouseHook_); mouseHook_ = nullptr; }
  for (const auto& entry : shortcuts_) UnregisterHotKey(messageWindow_, entry.first);
  shortcuts_.clear();
  if (messageWindow_) { DestroyWindow(messageWindow_); messageWindow_ = nullptr; }
  if (ownsMutex_) { ReleaseMutex(mutex_); ownsMutex_ = false; }
  if (mutex_) { CloseHandle(mutex_); mutex_ = nullptr; }
  mouseRuntime = nullptr;
}
LRESULT CALLBACK Runtime::WindowProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  Runtime* self = reinterpret_cast<Runtime*>(GetWindowLongPtrW(window, GWLP_USERDATA));
  if (message == WM_NCCREATE) {
    self = reinterpret_cast<Runtime*>(reinterpret_cast<CREATESTRUCTW*>(lparam)->lpCreateParams);
    SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
  }
  if (self) {
    if (message == COMMAND) { (*reinterpret_cast<std::function<void()>*>(lparam))(); return 0; }
    if (message == self->activation_) { self->Emit("activation"); return 0; }
    if (message == WM_HOTKEY && self->shortcuts_.contains(static_cast<int>(wparam))) { self->Emit("action", static_cast<int>(wparam)); return 0; }
  }
  return DefWindowProcW(window, message, wparam, lparam);
}
void Runtime::Call(const std::function<void()>& operation) {
  std::lock_guard guard(callMutex_);
  if (stopped_) throw std::runtime_error("The Windows platform has been disposed.");
  std::exception_ptr error;
  std::function<void()> safe = [&] { try { operation(); } catch (...) { error = std::current_exception(); } };
  SendMessageW(messageWindow_, COMMAND, 0, reinterpret_cast<LPARAM>(&safe));
  if (error) std::rethrow_exception(error);
}
bool Runtime::Acquire() {
  bool acquired = false;
  Call([&] {
    if (ownsMutex_) { acquired = true; return; }
    auto user = UserSid(); activationName_ = L"SC.Activation." + user;
    if (!mutex_) mutex_ = CreateMutexW(nullptr, FALSE, (L"Local\\SC.Application." + user).c_str());
    if (!mutex_) throw Failure("SC could not acquire the application session");
    auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(8);
    do {
      DWORD wait = WaitForSingleObject(mutex_, 0);
      if (wait == WAIT_OBJECT_0 || wait == WAIT_ABANDONED) {
        ownsMutex_ = true; acquired = true;
        if (!SetWindowTextW(messageWindow_, activationName_.c_str())) throw Failure("SC could not name its activation window");
        return;
      }
      if (wait == WAIT_FAILED) throw Failure("SC could not acquire the application session");
      HWND existing = FindWindowExW(HWND_MESSAGE, nullptr, nullptr, activationName_.c_str());
      if (existing) {
        DWORD process = 0; GetWindowThreadProcessId(existing, &process); AllowSetForegroundWindow(process);
        if (PostMessageW(existing, activation_, 0, 0)) return;
      }
      Sleep(40);
    } while (std::chrono::steady_clock::now() < deadline);
    throw std::runtime_error("SC is still starting. Try opening it again in a moment.");
  });
  return acquired;
}
void Runtime::Apply(const std::vector<Binding>& bindings) {
  std::map<int, Binding> target;
  std::set<std::pair<UINT, UINT>> identities;
  for (auto b : bindings) {
    if (!ValidBinding(b) || target.contains(b.id) || !identities.emplace(b.modifiers, b.key).second) throw std::runtime_error("Each action needs a valid, different shortcut.");
    target[b.id] = b;
  }
  Call([&] {
    auto previous = shortcuts_;
    for (auto it = shortcuts_.begin(); it != shortcuts_.end();) {
      auto desired = target.find(it->first);
      if (desired == target.end() || !(desired->second == it->second)) { UnregisterHotKey(messageWindow_, it->first); it = shortcuts_.erase(it); }
      else ++it;
    }
    for (auto [id, binding] : target) {
      if (shortcuts_.contains(id)) continue;
      if (RegisterHotKey(messageWindow_, id, binding.modifiers | MOD_NOREPEAT, binding.key)) { shortcuts_[id] = binding; continue; }
      for (auto entry : shortcuts_) UnregisterHotKey(messageWindow_, entry.first);
      shortcuts_.clear(); bool restored = true;
      for (auto [oldId, oldBinding] : previous) {
        if (RegisterHotKey(messageWindow_, oldId, oldBinding.modifiers | MOD_NOREPEAT, oldBinding.key)) shortcuts_[oldId] = oldBinding;
        else restored = false;
      }
      if (!restored) throw std::runtime_error("Could not restore the previous shortcuts. Restart SC.");
      throw std::runtime_error("Windows could not register a shortcut; it may be reserved or already in use.");
    }
  });
}
void Runtime::Attach(HWND panel) {
  Call([&] {
    if (!mouseHook_) {
      mouseHook_ = SetWindowsHookExW(WH_MOUSE_LL, MouseProc, GetModuleHandleW(nullptr), 0);
      if (!mouseHook_) throw Failure("Could not start hover scrolling");
    }
    if (panel_ != panel) { panelResizeEnabled_ = false; drag_.window = nullptr; dragCancelled_ = true; }
    panel_ = panel;
  });
}
void Runtime::Detach() {
  Call([&] { drag_.window = nullptr; dragCancelled_ = true; panelResizeEnabled_ = false; panel_ = nullptr; if (mouseHook_) { UnhookWindowsHookEx(mouseHook_); mouseHook_ = nullptr; } });
}
void Runtime::SetPanelResizeEnabled(HWND window, bool enabled) {
  Call([&] {
    if (window != panel_) {
      if (enabled) throw std::runtime_error("The panel resize owner is not attached.");
      return; // Startup may disable resizing before the panel is attached.
    }
    panelResizeEnabled_ = enabled;
    if (!enabled && drag_.edge != 0) { drag_.window = nullptr; dragCancelled_ = true; }
  });
}
void Runtime::BeginDrag(HWND window, int edge) {
  Call([&] {
    // A delayed renderer command cannot revive a press canceled by hiding,
    // even if the same window has already been shown again.
    if (window != panel_ || (edge != 0 && !panelResizeEnabled_) || dragCancelled_ || !IsWindowVisible(window) || !(GetAsyncKeyState(VK_LBUTTON) & 0x8000)) return;
    POINT pointer {};
    if (!GetCursorPos(&pointer) || !ConfigureDrag(window, edge, pointer)) throw Failure("The panel could not begin moving");
  });
}
void Runtime::CancelDrag(HWND window) {
  DWORD process = 0;
  if (GetWindowThreadProcessId(window, &process) != GetCurrentThreadId() || process != GetCurrentProcessId())
    throw std::runtime_error("Panel interaction must be canceled on its owning UI thread.");
  Call([&] { drag_.window = nullptr; dragCancelled_ = true; });
  // Electron's resizable outer frame can run a separate Win32 move/size loop.
  // Cancel that loop and its owned capture on the UI thread as well.
  SendMessageW(window, WM_CANCELMODE, 0, 0);
  HWND captured = GetCapture();
  if (captured && (captured == window || IsChild(window, captured))) ReleaseCapture();
}
bool Runtime::ConfigureDrag(HWND window, int edge, POINT pointer) {
  MONITORINFO monitor {sizeof(MONITORINFO)};
  RECT bounds {};
  if (!IsWindowVisible(window) || !GetWindowRect(window, &bounds) || !GetMonitorInfoW(MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST), &monitor)) return false;
  UINT dpi = GetDpiForWindow(window); if (!dpi) dpi = 96;
  drag_.window = window; drag_.intercepted = false; drag_.edge = edge; drag_.pointer = pointer; drag_.rectangle = bounds; drag_.workArea = monitor.rcWork;
  drag_.minWidth = std::min(MulDiv(180, dpi, 96), static_cast<int>(monitor.rcWork.right - monitor.rcWork.left));
  drag_.minHeight = std::min(MulDiv(80, dpi, 96), static_cast<int>(monitor.rcWork.bottom - monitor.rcWork.top));
  return true;
}
LRESULT CALLBACK Runtime::MouseProc(int code, WPARAM message, LPARAM data) {
  return mouseRuntime ? mouseRuntime->Mouse(code, message, data) : CallNextHookEx(nullptr, code, message, data);
}
LRESULT Runtime::Mouse(int code, WPARAM message, LPARAM data) {
  if (code < 0) return CallNextHookEx(mouseHook_, code, message, data);
  const auto& mouse = *reinterpret_cast<MSLLHOOKSTRUCT*>(data);
  RECT bounds {};
  bool hover = panel_ && IsWindowVisible(panel_) && GetWindowRect(panel_, &bounds) && PtInRect(&bounds, mouse.pt);
  if (message == WM_LBUTTONDOWN) { drag_.window = nullptr; dragCancelled_ = !hover; drag_.intercepted = false; }
  if (message == WM_LBUTTONDOWN && hover && (GetAsyncKeyState(VK_MENU) & 0x8000)) {
    if (ConfigureDrag(panel_, 0, mouse.pt)) { drag_.intercepted = true; return 1; }
  }
  if (message == WM_LBUTTONDOWN && hover && panelResizeEnabled_ &&
      GetAncestor(WindowFromPoint(mouse.pt), GA_ROOT) == panel_) {
    // The outer Win32 frame can consume an edge press before the renderer.
    // Own that press too, so every resize uses our work-area and anchor rules.
    // Electron can enter native sizing without the WS_THICKFRAME style bit;
    // the displayed application surface supplies the resize permission.
    UINT dpi = GetDpiForWindow(panel_); if (!dpi) dpi = 96;
    int border = std::max(1, MulDiv(7, dpi, 96));
    int edge = mouse.pt.x < bounds.left + border ? 1 : mouse.pt.x >= bounds.right - border ? 2 : 0;
    if (mouse.pt.y < bounds.top + border) edge |= 4;
    else if (mouse.pt.y >= bounds.bottom - border) edge |= 8;
    if (edge && ConfigureDrag(panel_, edge, mouse.pt)) { drag_.intercepted = true; return 1; }
  }
  if (message == WM_LBUTTONUP) {
    bool intercepted = drag_.intercepted;
    drag_.window = nullptr; dragCancelled_ = true; drag_.intercepted = false;
    if (intercepted) return 1;
  }
  if (drag_.window && message == WM_MOUSEMOVE) {
    // A swallowed Alt/edge-down never updates the asynchronous button state.
    // Its hook-delivered up ends the drag; renderer-started drags can also use
    // the asynchronous state to discard stale IPC requests.
    if ((!drag_.intercepted && !(GetAsyncKeyState(VK_LBUTTON) & 0x8000)) || !IsWindow(drag_.window) || !IsWindowVisible(drag_.window)) { drag_.window = nullptr; dragCancelled_ = true; }
    else {
      LONG dx = mouse.pt.x - drag_.pointer.x, dy = mouse.pt.y - drag_.pointer.y;
      RECT r = drag_.rectangle;
      if (drag_.edge == 0) OffsetRect(&r, dx, dy);
      else {
        if (drag_.edge & 1) r.left = std::clamp(r.left + dx, drag_.workArea.left, std::max(drag_.workArea.left, r.right - drag_.minWidth));
        if (drag_.edge & 2) r.right = std::clamp(r.right + dx, std::min(r.left + drag_.minWidth, drag_.workArea.right), drag_.workArea.right);
        if (drag_.edge & 4) r.top = std::clamp(r.top + dy, drag_.workArea.top, std::max(drag_.workArea.top, r.bottom - drag_.minHeight));
        if (drag_.edge & 8) r.bottom = std::clamp(r.bottom + dy, std::min(r.top + drag_.minHeight, drag_.workArea.bottom), drag_.workArea.bottom);
      }
      SetWindowPos(drag_.window, nullptr, r.left, r.top, r.right - r.left, r.bottom - r.top, SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS);
      return 1;
    }
  }
  if (message == WM_MOUSEWHEEL && hover && mouse.pt.y < bounds.bottom - inputHeight_.load()) {
    Emit("wheel", static_cast<SHORT>(HIWORD(mouse.mouseData))); return 1;
  }
  return CallNextHookEx(mouseHook_, code, message, data);
}
void Runtime::InstallProtection(DWORD thread) {
  std::lock_guard guard(hooksMutex_);
  if (hooks_.contains(thread)) return;
  {
    std::lock_guard registry(protectionRegistryMutex);
    auto existing = protectionRegistry.find(thread);
    auto owner = existing == protectionRegistry.end() ? nullptr : existing->second.lock();
    if (owner && owner.get() != this) throw std::runtime_error("Another SC capture-protection owner is active.");
    protectionRegistry[thread] = shared_from_this();
  }
  HHOOK hook = SetWindowsHookExW(WH_CALLWNDPROC, ProtectionProc, nullptr, thread);
  if (!hook) {
    std::lock_guard registry(protectionRegistryMutex); protectionRegistry.erase(thread);
    protectionResult_ = 2; throw Failure("Could not initialize window capture exclusion");
  }
  hooks_[thread] = hook;
}
void Runtime::RemoveProtection(DWORD thread) {
  std::lock_guard guard(hooksMutex_);
  if (hooks_.contains(thread)) { UnhookWindowsHookEx(hooks_[thread]); hooks_.erase(thread); }
  std::lock_guard registry(protectionRegistryMutex); protectionRegistry.erase(thread);
}
void Runtime::StartProtection() {
  if (stopped_) throw std::runtime_error("The Windows platform has been disposed.");
  InstallProtection(GetCurrentThreadId()); protectionStarted_ = true;
}
std::string Runtime::Protect(HWND window) {
  if (stopped_) throw std::runtime_error("The Windows platform has been disposed.");
  DWORD process = 0, thread = GetWindowThreadProcessId(window, &process);
  if (process != GetCurrentProcessId()) throw std::runtime_error("The window must belong to this SC process.");
  bool hookFailed = false;
  if (protectionStarted_) { try { InstallProtection(thread); } catch (...) { hookFailed = true; } }
  int result = Affinity(GetAncestor(window, GA_ROOT));
  RecordProtection(protectionResult_, hookFailed ? 2 : result);
  return Result(protectionResult_);
}
std::string Runtime::ProtectionStatus() const { return Result(protectionResult_); }
LRESULT CALLBACK Runtime::ProtectionProc(int code, WPARAM wparam, LPARAM lparam) {
  std::shared_ptr<Runtime> self;
  { std::lock_guard guard(protectionRegistryMutex); auto it = protectionRegistry.find(GetCurrentThreadId()); if (it != protectionRegistry.end()) self = it->second.lock(); }
  if (self && code >= 0 && !applyingProtection) {
    const auto& message = *reinterpret_cast<CWPSTRUCT*>(lparam);
    if ((message.message == WM_WINDOWPOSCHANGING || (message.message == WM_SHOWWINDOW && message.wParam)) && GetAncestor(message.hwnd, GA_ROOT) == message.hwnd) {
      applyingProtection = true;
      int result = Affinity(message.hwnd);
      if (message.message == WM_WINDOWPOSCHANGING) {
        HWND owner = GetWindow(message.hwnd, GW_OWNER);
        std::lock_guard guard(self->dialogsMutex_);
        while (owner) {
          if (self->hiddenOwners_.contains(owner)) {
            reinterpret_cast<WINDOWPOS*>(message.lParam)->flags &= ~SWP_SHOWWINDOW;
            self->hiddenDialogs_.insert(message.hwnd); break;
          }
          owner = GetWindow(owner, GW_OWNER);
        }
      }
      RecordProtection(self->protectionResult_, result);
      applyingProtection = false;
    }
  }
  return CallNextHookEx(nullptr, code, wparam, lparam);
}
UINT_PTR CALLBACK Runtime::ColorProc(HWND window, UINT message, WPARAM, LPARAM lparam) {
  if (message == WM_INITDIALOG) {
    auto choose = reinterpret_cast<CHOOSECOLORW*>(lparam);
    auto context = reinterpret_cast<ColorContext*>(choose->lCustData);
    auto self = context->self;
    SetPropW(window, L"SC.ColorOwner", self);
    try { self->Protect(window); }
    catch (...) { self->protectionResult_ = 2; }
    bool cancelled = false;
    {
      std::lock_guard guard(self->dialogsMutex_);
      self->dialogs_[window] = context->owner;
      cancelled = self->stopped_ || self->dialogGenerations_[context->owner] != context->generation;
    }
    if (cancelled) PostMessageW(window, WM_COMMAND, IDCANCEL, 0);
  } else if (message == WM_DESTROY) {
    auto self = reinterpret_cast<Runtime*>(RemovePropW(window, L"SC.ColorOwner"));
    if (self) {
      std::lock_guard guard(self->dialogsMutex_);
      self->dialogs_.erase(window); self->hiddenDialogs_.erase(window);
    }
  }
  return 0;
}
uint64_t Runtime::PrepareColor(HWND owner) {
  std::lock_guard guard(dialogsMutex_);
  if (stopped_) throw std::runtime_error("The Windows platform has been disposed.");
  return dialogGenerations_[owner];
}
void Runtime::CloseDialogs(HWND owner) {
  std::lock_guard guard(dialogsMutex_);
  ++dialogGenerations_[owner];
  // Only cancel pickers created and tracked by this runtime for this owner.
  // Generations also invalidate queued workers and dialogs still being created.
  for (auto [window, dialogOwner] : dialogs_) {
    if (dialogOwner == owner && IsWindow(window)) PostMessageW(window, WM_COMMAND, IDCANCEL, 0);
  }
}
std::string Runtime::Choose(HWND owner, const std::string& initial, uint64_t generation) {
  {
    std::lock_guard guard(dialogsMutex_);
    if (stopped_ || dialogGenerations_[owner] != generation) return {};
    ++colorWorkers_;
  }
  DWORD thread = GetCurrentThreadId();
  std::string result;
  try {
    // Native modal loop runs on a worker, with its own pre-display protection hook.
    MSG queued {}; PeekMessageW(&queued, nullptr, 0, 0, PM_NOREMOVE);
    InstallProtection(thread);
    struct Apartment {
      HRESULT status = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
      ~Apartment() { if (SUCCEEDED(status)) CoUninitialize(); }
    } apartment;
    if (FAILED(apartment.status)) throw std::runtime_error("The color dialog apartment could not be initialized.");
    COLORREF custom[16] {};
    auto rgb = std::stoul(initial.substr(1), nullptr, 16);
    ColorContext context {this, owner, generation};
    CHOOSECOLORW choose {}; choose.lStructSize = sizeof(choose); choose.hwndOwner = owner;
    choose.rgbResult = RGB((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255); choose.lpCustColors = custom;
    choose.Flags = CC_RGBINIT | CC_FULLOPEN | CC_ENABLEHOOK; choose.lpfnHook = ColorProc; choose.lCustData = reinterpret_cast<LPARAM>(&context);
    if (ChooseColorW(&choose)) {
      char color[8]; snprintf(color, sizeof(color), "#%02X%02X%02X", GetRValue(choose.rgbResult), GetGValue(choose.rgbResult), GetBValue(choose.rgbResult)); result = color;
    } else { DWORD error = CommDlgExtendedError(); if (error) throw Failure("The color dialog could not be opened", error); }
    SecureZeroMemory(custom, sizeof(custom));
    { std::lock_guard guard(dialogsMutex_); if (dialogGenerations_[owner] != generation || stopped_) result.clear(); }
  } catch (...) {
    RemoveProtection(thread);
    { std::lock_guard guard(dialogsMutex_);
      for (auto it = dialogs_.begin(); it != dialogs_.end();) {
        if (!IsWindow(it->first)) { hiddenDialogs_.erase(it->first); it = dialogs_.erase(it); } else ++it;
      }
      --colorWorkers_; dialogsCv_.notify_all();
    }
    throw;
  }
  RemoveProtection(thread);
  { std::lock_guard guard(dialogsMutex_);
    for (auto it = dialogs_.begin(); it != dialogs_.end();) { if (!IsWindow(it->first)) { hiddenDialogs_.erase(it->first); it = dialogs_.erase(it); } else ++it; }
    --colorWorkers_; dialogsCv_.notify_all();
  }
  return result;
}
void Runtime::DialogsVisible(HWND owner, bool visible) {
  struct Context { Runtime* self; HWND owner; bool visible; } context {this, owner, visible};
  if (!visible) { std::lock_guard guard(dialogsMutex_); hiddenOwners_.insert(owner); }
  else { std::lock_guard guard(dialogsMutex_); hiddenOwners_.erase(owner); }
  EnumWindows([](HWND window, LPARAM raw) -> BOOL {
    auto& context = *reinterpret_cast<Context*>(raw);
    DWORD process = 0; GetWindowThreadProcessId(window, &process);
    if (process != GetCurrentProcessId() || window == context.owner) return TRUE;
    HWND parent = GetWindow(window, GW_OWNER);
    while (parent && parent != context.owner) parent = GetWindow(parent, GW_OWNER);
    if (parent != context.owner) return TRUE;
    bool show = false;
    { std::lock_guard guard(context.self->dialogsMutex_);
      if (!context.visible && IsWindowVisible(window)) context.self->hiddenDialogs_.insert(window);
      if (context.visible) show = context.self->hiddenDialogs_.erase(window) != 0;
    }
    if (!context.visible) ShowWindowAsync(window, SW_HIDE);
    else if (show) {
      try { context.self->Protect(window); } catch (...) { context.self->protectionResult_ = 2; }
      ShowWindowAsync(window, SW_SHOWNOACTIVATE);
    }
    return TRUE;
  }, reinterpret_cast<LPARAM>(&context));
}
void Runtime::Stop() {
  {
    std::lock_guard guard(callMutex_);
    if (stopped_.exchange(true)) return;
    if (thread_.joinable()) { PostThreadMessageW(threadId_, WM_QUIT, 0, 0); thread_.join(); }
  }
  {
    std::unique_lock guard(dialogsMutex_);
    for (auto [dialog, owner] : dialogs_) { (void)owner; if (IsWindow(dialog)) PostMessageW(dialog, WM_COMMAND, IDCANCEL, 0); }
    while (colorWorkers_ != 0) {
      // A native color dialog can synchronously notify its UI-thread owner on close.
      // Pump Windows messages while joining; JS callbacks remain queued in the TSFN.
      guard.unlock();
      MSG message {};
      while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
        if (message.message == WM_QUIT) { PostQuitMessage(static_cast<int>(message.wParam)); break; }
        TranslateMessage(&message); DispatchMessageW(&message);
      }
      guard.lock();
      dialogsCv_.wait_for(guard, std::chrono::milliseconds(10));
    }
    dialogs_.clear(); dialogGenerations_.clear(); hiddenDialogs_.clear(); hiddenOwners_.clear();
  }
  {
    std::lock_guard guard(hooksMutex_);
    for (auto [thread, hook] : hooks_) {
      UnhookWindowsHookEx(hook);
      std::lock_guard registry(protectionRegistryMutex); protectionRegistry.erase(thread);
    }
    hooks_.clear();
  }
  callback_.Release();
}
}
