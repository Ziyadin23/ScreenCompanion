#include "common.hpp"
namespace sc {
namespace {
class DpiScope {
 public:
  DpiScope() { previous_ = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); }
  ~DpiScope() { if (previous_) SetThreadDpiAwarenessContext(previous_); }
 private: DPI_AWARENESS_CONTEXT previous_ = nullptr;
};
class GdiPlus {
 public:
  GdiPlus() { Gdiplus::GdiplusStartupInput input; if (Gdiplus::GdiplusStartup(&token_, &input, nullptr) != Gdiplus::Ok) throw std::runtime_error("Windows image encoding could not start."); }
  ~GdiPlus() { Gdiplus::GdiplusShutdown(token_); }
 private: ULONG_PTR token_ = 0;
};
struct Stream {
  IStream* value = nullptr;
  explicit Stream(const Bytes* input = nullptr) {
    if (FAILED(CreateStreamOnHGlobal(nullptr, TRUE, &value))) throw std::runtime_error("Windows image memory could not be allocated.");
    try {
      if (input) {
        ULONG written = 0;
        if (FAILED(value->Write(input->data(), static_cast<ULONG>(input->size()), &written)) || written != input->size()) throw std::runtime_error("Windows image memory could not be written.");
        LARGE_INTEGER zero {};
        if (FAILED(value->Seek(zero, STREAM_SEEK_SET, nullptr))) throw std::runtime_error("Windows image memory could not be positioned.");
      }
    } catch (...) { Clear(); throw; }
  }
  ~Stream() { Clear(); }
  void Clear() noexcept {
    if (!value) return;
    HGLOBAL memory = nullptr;
    if (SUCCEEDED(GetHGlobalFromStream(value, &memory))) {
      void* bytes = GlobalLock(memory);
      if (bytes) { SecureZeroMemory(bytes, GlobalSize(memory)); GlobalUnlock(memory); }
    }
    value->Release(); value = nullptr;
  }
};
void ClearBitmap(Gdiplus::Bitmap& bitmap) {
  Gdiplus::Rect rectangle(0, 0, bitmap.GetWidth(), bitmap.GetHeight());
  Gdiplus::BitmapData data {};
  if (bitmap.LockBits(&rectangle, Gdiplus::ImageLockModeWrite, PixelFormat24bppRGB, &data) == Gdiplus::Ok) {
    for (UINT y = 0; y < bitmap.GetHeight(); ++y) SecureZeroMemory(static_cast<unsigned char*>(data.Scan0) + static_cast<int64_t>(y) * data.Stride, std::abs(data.Stride));
    bitmap.UnlockBits(&data);
  }
}
Bytes Encode(Gdiplus::Bitmap& bitmap, ULONG quality) {
  CLSID encoder {}; if (CLSIDFromString(L"{557CF401-1A04-11D3-9A73-0000F81EF32E}", &encoder) != S_OK) throw std::runtime_error("Windows JPEG encoding is unavailable.");
  Gdiplus::EncoderParameters parameters {}; parameters.Count = 1;
  parameters.Parameter[0].Guid = Gdiplus::EncoderQuality; parameters.Parameter[0].Type = Gdiplus::EncoderParameterValueTypeLong;
  parameters.Parameter[0].NumberOfValues = 1; parameters.Parameter[0].Value = &quality;
  Stream stream;
  auto status = bitmap.Save(stream.value, &encoder, &parameters);
  ClearBitmap(bitmap);
  if (status != Gdiplus::Ok) throw std::runtime_error("The monitor image could not be encoded.");
  STATSTG stats {}; if (FAILED(stream.value->Stat(&stats, STATFLAG_NONAME)) || stats.cbSize.HighPart) throw std::runtime_error("The encoded image is too large.");
  Bytes bytes(stats.cbSize.LowPart);
  LARGE_INTEGER zero {}; stream.value->Seek(zero, STREAM_SEEK_SET, nullptr);
  ULONG read = 0;
  if (FAILED(stream.value->Read(bytes.data(), static_cast<ULONG>(bytes.size()), &read)) || read != bytes.size()) { Wipe(bytes); throw std::runtime_error("The monitor image could not be read."); }
  return bytes;
}
}
Bounds Monitor(HWND window, bool active) {
  DpiScope dpi;
  HMONITOR monitor = nullptr;
  if (active) {
    window = GetForegroundWindow(); DWORD process = 0;
    if (window && IsWindowVisible(window) && !IsIconic(window) && GetWindowThreadProcessId(window, &process) && process != GetCurrentProcessId()) monitor = MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST);
    else { POINT point {}; if (!GetCursorPos(&point)) throw Failure("The pointer monitor could not be located"); monitor = MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST); }
  } else monitor = MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST);
  MONITORINFO info {sizeof(MONITORINFO)};
  if (!monitor || !GetMonitorInfoW(monitor, &info)) throw Failure("Windows did not report a usable monitor");
  auto r = info.rcMonitor;
  if (r.right <= r.left || r.bottom <= r.top) throw std::runtime_error("Windows did not report a usable monitor size.");
  return {r.left, r.top, r.right - r.left, r.bottom - r.top};
}
Bytes Capture(Bounds bounds) {
  DpiScope dpi; GdiPlus gdiplus;
  HDC screen = GetDC(nullptr);
  if (!screen) throw Failure("The monitor could not be captured");
  HDC memory = CreateCompatibleDC(screen);
  BITMAPINFO info {}; info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER); info.bmiHeader.biWidth = bounds.width;
  info.bmiHeader.biHeight = -bounds.height; info.bmiHeader.biPlanes = 1; info.bmiHeader.biBitCount = 24; info.bmiHeader.biCompression = BI_RGB;
  void* pixels = nullptr;
  HBITMAP bitmap = CreateDIBSection(screen, &info, DIB_RGB_COLORS, &pixels, nullptr, 0);
  HGDIOBJ previous = memory && bitmap ? SelectObject(memory, bitmap) : nullptr;
  Bytes result;
  try {
    if (!memory || !bitmap || !pixels || !previous || !BitBlt(memory, 0, 0, bounds.width, bounds.height, screen, bounds.x, bounds.y, SRCCOPY)) throw Failure("The monitor could not be captured");
    int stride = ((bounds.width * 3 + 3) / 4) * 4;
    Gdiplus::Bitmap image(bounds.width, bounds.height, stride, PixelFormat24bppRGB, static_cast<BYTE*>(pixels));
    result = Encode(image, 88);
  } catch (...) {
    if (pixels) SecureZeroMemory(pixels, static_cast<size_t>(((bounds.width * 3 + 3) / 4) * 4) * bounds.height);
    if (previous) SelectObject(memory, previous); if (bitmap) DeleteObject(bitmap); if (memory) DeleteDC(memory); ReleaseDC(nullptr, screen); throw;
  }
  SecureZeroMemory(pixels, static_cast<size_t>(((bounds.width * 3 + 3) / 4) * 4) * bounds.height);
  SelectObject(memory, previous); DeleteObject(bitmap); DeleteDC(memory); ReleaseDC(nullptr, screen);
  return result;
}
Bytes Crop(const Bytes& input, Region r) {
  if (!std::isfinite(r.x) || !std::isfinite(r.y) || !std::isfinite(r.width) || !std::isfinite(r.height) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1.000001 || r.y + r.height > 1.000001) throw std::runtime_error("The image crop has invalid bounds.");
  GdiPlus gdiplus; Stream stream(&input);
  Gdiplus::Bitmap original(stream.value);
  UINT width = original.GetWidth(), height = original.GetHeight();
  if (original.GetLastStatus() != Gdiplus::Ok || !width || !height || static_cast<uint64_t>(width) * height > 128 * 1024 * 1024) throw std::runtime_error("The JPEG image has invalid dimensions.");
  int left = std::clamp(static_cast<int>(std::floor(r.x * width)), 0, static_cast<int>(width) - 1);
  int top = std::clamp(static_cast<int>(std::floor(r.y * height)), 0, static_cast<int>(height) - 1);
  int right = std::clamp(static_cast<int>(std::ceil((r.x + r.width) * width)), left + 1, static_cast<int>(width));
  int bottom = std::clamp(static_cast<int>(std::ceil((r.y + r.height) * height)), top + 1, static_cast<int>(height));
  std::unique_ptr<Gdiplus::Bitmap> crop(original.Clone(left, top, right - left, bottom - top, PixelFormat24bppRGB));
  ClearBitmap(original);
  if (!crop || crop->GetLastStatus() != Gdiplus::Ok) throw std::runtime_error("The JPEG image could not be cropped.");
  return Encode(*crop, 95);
}
Bytes Dpapi(const unsigned char* input, size_t length, bool protect) {
  if (!length || length > 1024 * 1024) throw std::runtime_error("The Windows user protection input has invalid dimensions.");
  Bytes copy(input, input + length);
  DATA_BLOB in {static_cast<DWORD>(length), copy.data()};
  struct LocalBlob {
    DATA_BLOB value {};
    ~LocalBlob() { if (value.pbData) { SecureZeroMemory(value.pbData, value.cbData); LocalFree(value.pbData); } }
  } output;
  auto& out = output.value;
  BOOL success = protect ? CryptProtectData(&in, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &out)
    : CryptUnprotectData(&in, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &out);
  DWORD code = GetLastError(); Wipe(copy);
  if (!success) throw Failure("The saved settings could not be opened for this Windows user", code);
  Bytes result;
  if (out.pbData && out.cbData && out.cbData <= 1024 * 1024) result.assign(out.pbData, out.pbData + out.cbData);
  if (result.empty()) throw std::runtime_error("The saved settings are invalid or damaged.");
  return result;
}
}
