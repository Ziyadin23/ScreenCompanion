{
  "targets": [{
    "target_name": "sc_windows",
    "sources": ["addon.cpp", "runtime.cpp", "imaging.cpp", "http.cpp"],
    "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
    "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
    "defines": ["NAPI_CPP_EXCEPTIONS", "NODE_ADDON_API_CPP_EXCEPTIONS_ALL", "UNICODE", "_UNICODE", "NOMINMAX", "WIN32_LEAN_AND_MEAN", "_WIN32_WINNT=0x0A00"],
    "defines!": ["_HAS_EXCEPTIONS=0"],
    "conditions": [["OS=='win'", {
      "defines": ["_HAS_EXCEPTIONS=1"],
      "libraries": ["user32.lib", "gdi32.lib", "gdiplus.lib", "crypt32.lib", "advapi32.lib", "winhttp.lib", "comdlg32.lib", "ole32.lib", "comctl32.lib"],
      "msvs_settings": {
        "VCCLCompilerTool": {"ExceptionHandling": 1, "AdditionalOptions": ["/std:c++20", "/utf-8", "/W4"]},
        "VCLinkerTool": {"AdditionalOptions": ["/PDBALTPATH:sc_windows.pdb"]}
      }
    }, {"type": "none"}]]
  }]
}
