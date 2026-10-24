#include "runtime.hpp"
namespace sc {
class Bridge final : public Napi::ObjectWrap<Bridge> {
 public:
  explicit Bridge(const Napi::CallbackInfo& info) : Napi::ObjectWrap<Bridge>(info) {
    runtime_ = std::make_shared<Runtime>(info.Env(), info[0].As<Napi::Function>());
  }
  ~Bridge() override { DisposeNative(); }
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    auto constructor = DefineClass(env, "WindowsBridge", {
      InstanceMethod("acquireInstance", &Bridge::Acquire), InstanceMethod("startCaptureProtection", &Bridge::StartProtection),
      InstanceMethod("protectWindow", &Bridge::Protect), InstanceMethod("captureProtectionStatus", &Bridge::ProtectionStatus),
      InstanceMethod("activeMonitor", &Bridge::ActiveMonitor), InstanceMethod("monitorForWindow", &Bridge::WindowMonitor),
      InstanceMethod("captureMonitor", &Bridge::CaptureMonitor), InstanceMethod("crop", &Bridge::CropImage),
      InstanceMethod("protectData", &Bridge::ProtectData), InstanceMethod("unprotectData", &Bridge::UnprotectData),
      InstanceMethod("applyShortcuts", &Bridge::Apply), InstanceMethod("attachPanel", &Bridge::Attach),
      InstanceMethod("detachPanel", &Bridge::Detach), InstanceMethod("setHoverInputHeight", &Bridge::InputHeight),
      InstanceMethod("beginMove", &Bridge::Move), InstanceMethod("beginResize", &Bridge::Resize),
      InstanceMethod("chooseColor", &Bridge::Choose), InstanceMethod("setOwnedDialogsVisible", &Bridge::DialogsVisible),
      InstanceMethod("closeOwnedDialogs", &Bridge::CloseDialogs),
      InstanceMethod("send", &Bridge::Send), InstanceMethod("cancelRequest", &Bridge::CancelRequest), InstanceMethod("dispose", &Bridge::Dispose)
    });
    auto reference = std::make_shared<Napi::FunctionReference>(Napi::Persistent(constructor));
    exports.Set("createBridge", Napi::Function::New(env, [reference](const Napi::CallbackInfo& info) -> Napi::Value {
      return reference->New({info[0]});
    }));
    return exports;
  }
 private:
  std::shared_ptr<Runtime> runtime_;
  std::map<int64_t, std::shared_ptr<HttpOperation>> requests_;
  void Check() { if (!runtime_ || runtime_->Stopped()) throw std::runtime_error("The Windows platform has been disposed."); }
  void DisposeNative() {
    for (auto& [id, request] : requests_) { (void)id; request->Cancel(); }
    requests_.clear();
    if (runtime_) runtime_->Stop();
  }
  Napi::Value Acquire(const Napi::CallbackInfo& info) {
    Check(); auto runtime = runtime_; auto result = std::make_shared<bool>(false);
    return (new Work(info.Env(), [runtime, result] { *result = runtime->Acquire(); }, [result](Napi::Env env) { return Napi::Boolean::New(env, *result); }))->Start();
  }
  Napi::Value StartProtection(const Napi::CallbackInfo& info) { Check(); runtime_->StartProtection(); return info.Env().Undefined(); }
  Napi::Value Protect(const Napi::CallbackInfo& info) { Check(); return Napi::String::New(info.Env(), runtime_->Protect(Handle(info[0]))); }
  Napi::Value ProtectionStatus(const Napi::CallbackInfo& info) { Check(); return Napi::String::New(info.Env(), runtime_->ProtectionStatus()); }
  Napi::Value ActiveMonitor(const Napi::CallbackInfo& info) { Check(); return ToJs(info.Env(), Monitor(nullptr, true)); }
  Napi::Value WindowMonitor(const Napi::CallbackInfo& info) { Check(); return ToJs(info.Env(), Monitor(Handle(info[0]), false)); }
  Napi::Value CaptureMonitor(const Napi::CallbackInfo& info) {
    Check(); Bounds bounds = ReadBounds(info[0]); auto result = std::make_shared<SecretBytes>();
    return (new Work(info.Env(), [result, bounds] { result->value = Capture(bounds); }, [result, bounds](Napi::Env env) {
      auto output = Napi::Object::New(env); output.Set("bounds", ToJs(env, bounds));
      output.Set("jpeg", Napi::Buffer<unsigned char>::Copy(env, result->value.data(), result->value.size())); Wipe(result->value); return output;
    }))->Start();
  }
  Napi::Value CropImage(const Napi::CallbackInfo& info) {
    Check(); auto bytes = info[0].As<Napi::Buffer<unsigned char>>();
    if (bytes.Length() == 0 || bytes.Length() > 128 * 1024 * 1024) throw std::runtime_error("The JPEG image is invalid or too large.");
    auto input = std::make_shared<SecretBytes>(); input->value.assign(bytes.Data(), bytes.Data() + bytes.Length());
    auto output = std::make_shared<SecretBytes>(); auto r = info[1].As<Napi::Object>();
    Region region {r.Get("x").As<Napi::Number>().DoubleValue(), r.Get("y").As<Napi::Number>().DoubleValue(), r.Get("width").As<Napi::Number>().DoubleValue(), r.Get("height").As<Napi::Number>().DoubleValue()};
    return (new Work(info.Env(), [input, output, region] { output->value = Crop(input->value, region); Wipe(input->value); }, [output](Napi::Env env) {
      auto result = Napi::Buffer<unsigned char>::Copy(env, output->value.data(), output->value.size()); Wipe(output->value); return result;
    }))->Start();
  }
  Napi::Value Data(const Napi::CallbackInfo& info, bool protect) {
    Check(); auto input = info[0].As<Napi::Buffer<unsigned char>>();
    SecretBytes result {Dpapi(input.Data(), input.Length(), protect)};
    return Napi::Buffer<unsigned char>::Copy(info.Env(), result.value.data(), result.value.size());
  }
  Napi::Value ProtectData(const Napi::CallbackInfo& info) { return Data(info, true); }
  Napi::Value UnprotectData(const Napi::CallbackInfo& info) { return Data(info, false); }
  Napi::Value Apply(const Napi::CallbackInfo& info) {
    Check(); auto input = info[0].As<Napi::Array>(); std::vector<Binding> bindings;
    for (uint32_t i = 0; i < input.Length(); ++i) {
      auto b = input.Get(i).As<Napi::Object>();
      bindings.push_back({b.Get("id").As<Napi::Number>().Int32Value(), b.Get("modifiers").As<Napi::Number>().Uint32Value(), b.Get("key").As<Napi::Number>().Uint32Value()});
    }
    runtime_->Apply(bindings); return info.Env().Undefined();
  }
  Napi::Value Attach(const Napi::CallbackInfo& info) { Check(); runtime_->Attach(Handle(info[0])); return info.Env().Undefined(); }
  Napi::Value Detach(const Napi::CallbackInfo& info) { Check(); runtime_->Detach(); return info.Env().Undefined(); }
  Napi::Value InputHeight(const Napi::CallbackInfo& info) { Check(); runtime_->InputHeight(info[0].As<Napi::Number>().Int32Value()); return info.Env().Undefined(); }
  Napi::Value Move(const Napi::CallbackInfo& info) { Check(); runtime_->BeginDrag(Handle(info[0]), 0); return info.Env().Undefined(); }
  Napi::Value Resize(const Napi::CallbackInfo& info) {
    Check(); std::map<std::string, int> edges {{"left", 1}, {"right", 2}, {"top", 4}, {"bottom", 8}, {"top-left", 5}, {"top-right", 6}, {"bottom-left", 9}, {"bottom-right", 10}};
    auto edge = info[1].As<Napi::String>().Utf8Value(); if (!edges.contains(edge)) throw std::runtime_error("The resize edge is invalid.");
    runtime_->BeginDrag(Handle(info[0]), edges[edge]); return info.Env().Undefined();
  }
  Napi::Value Choose(const Napi::CallbackInfo& info) {
    Check(); auto runtime = runtime_; HWND owner = Handle(info[0]); auto color = info[1].As<Napi::String>().Utf8Value();
    auto result = std::make_shared<std::string>();
    auto generation = runtime->PrepareColor(owner);
    return (new Work(info.Env(), [runtime, owner, color, result, generation] { *result = runtime->Choose(owner, color, generation); }, [result](Napi::Env env) -> Napi::Value { return result->empty() ? env.Null() : Napi::String::New(env, *result); }))->Start();
  }
  Napi::Value DialogsVisible(const Napi::CallbackInfo& info) { Check(); runtime_->DialogsVisible(Handle(info[0]), info[1].As<Napi::Boolean>()); return info.Env().Undefined(); }
  Napi::Value CloseDialogs(const Napi::CallbackInfo& info) { Check(); runtime_->CloseDialogs(Handle(info[0])); return info.Env().Undefined(); }
  Napi::Value Send(const Napi::CallbackInfo& info) {
    Check(); auto request = info[0].As<Napi::Object>(); auto headers = request.Get("headers").As<Napi::Object>();
    std::map<std::string, std::string> headerMap; auto names = headers.GetPropertyNames();
    for (uint32_t i = 0; i < names.Length(); ++i) { auto name = names.Get(i).As<Napi::String>(); headerMap[name.Utf8Value()] = headers.Get(name).As<Napi::String>().Utf8Value(); }
    auto buffer = request.Get("body").As<Napi::Buffer<unsigned char>>();
    if (buffer.Length() > 128 * 1024 * 1024) throw std::runtime_error("The HTTP request exceeded the supported size.");
    int connect = request.Get("connectTimeoutMs").As<Napi::Number>().Int32Value(), timeout = request.Get("timeoutMs").As<Napi::Number>().Int32Value();
    auto operation = std::make_shared<HttpOperation>(request.Get("url").As<Napi::String>().Utf8Value(), std::move(headerMap), Bytes(buffer.Data(), buffer.Data() + buffer.Length()), connect, timeout);
    int64_t id = info[1].As<Napi::Number>().Int64Value(); requests_[id] = operation;
    // JS wrapper cancels by ID. Erasure is scheduled on the JS thread for both success and failure.
    auto owner = Napi::Persistent(Value());
    auto ownerRef = std::make_shared<Napi::ObjectReference>(std::move(owner));
    auto promise = (new Work(info.Env(), [operation] { operation->Run(); }, [operation](Napi::Env env) {
      auto response = Napi::Object::New(env), headers = Napi::Object::New(env);
      for (const auto& [name, value] : operation->result.headers) headers.Set(name, value);
      response.Set("status", operation->result.status); response.Set("headers", headers);
      response.Set("body", Napi::Buffer<unsigned char>::Copy(env, operation->result.body.data(), operation->result.body.size())); Wipe(operation->result.body); return response;
    }))->Start();
    auto clean = Napi::Function::New(info.Env(), [this, id, ownerRef](const Napi::CallbackInfo& callback) -> Napi::Value {
      requests_.erase(id); ownerRef->Reset(); return callback.Env().Undefined();
    });
    // finally preserves rejection while ensuring the native request and copied headers are released.
    return promise.Get("finally").As<Napi::Function>().Call(promise, {clean});
  }
  Napi::Value CancelRequest(const Napi::CallbackInfo& info) {
    int64_t id = info[0].As<Napi::Number>().Int64Value(); auto found = requests_.find(id); if (found != requests_.end()) found->second->Cancel(); return info.Env().Undefined();
  }
  Napi::Value Dispose(const Napi::CallbackInfo& info) { DisposeNative(); return info.Env().Undefined(); }
};
Napi::Object Initialize(Napi::Env env, Napi::Object exports) { return Bridge::Init(env, exports); }
NODE_API_MODULE(sc_windows, Initialize)
}
