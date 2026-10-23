using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal static class NetworkTests
{
    public static async Task Run()
    {
        DiagnosticGuidance();
        await RedirectIsNotFollowed();
        await BodyTimeoutAndCancellation();
        foreach (var provider in Enum.GetValues<ApiProvider>())
        {
            foreach (var status in new[] { 302, 307, 407, 511, 200 })
            {
                using var handler = new NetworkResponseHandler(status);
                using var client = new HttpClient(handler);
                try
                {
                    await ModelApiClient.SendAsync(client, "synthetic-network-key", "fixture-model", "instruction",
                        new JsonArray(new JsonObject { ["type"] = "input_text", ["text"] = "synthetic task" }),
                        new JsonObject { ["type"] = "object" }, 256, provider);
                    throw new Exception($"FAIL: {provider} accepted a network sign-in response ({status})");
                }
                catch (Exception error) when (error is HttpRequestException or InvalidOperationException)
                {
                    var expected = status == 407 ? "proxy" : "sign in";
                    TestCheck.That(error.Message.Contains(expected, StringComparison.OrdinalIgnoreCase),
                        $"{provider} gives {expected} guidance for network response {status}");
                    TestCheck.That(!error.Message.Contains("PRIVATE-PORTAL-SENTINEL", StringComparison.Ordinal),
                        "network error never displays the intercepted response body");
                    TestCheck.That(handler.Calls == 1, "network failures do not retry or switch services");
                }
            }
        }
    }

    private static void DiagnosticGuidance()
    {
        var path = Path.Combine(Path.GetTempPath(), "sc-network-" + Guid.NewGuid().ToString("N"), "diagnostics.log");
        try
        {
            foreach (var (kind, expected) in new[]
            {
                (HttpRequestError.NameResolutionError, "DNS"),
                (HttpRequestError.SecureConnectionError, "TLS"),
                (HttpRequestError.ProxyTunnelError, "proxy"),
                (HttpRequestError.ConnectionError, "443")
            })
            {
                var report = AppDiagnostics.Record(FailureStage.ApiRequest,
                    new HttpRequestException(kind, "PRIVATE-EXCEPTION-SENTINEL"), path);
                TestCheck.That(report.Hint.Contains(expected, StringComparison.OrdinalIgnoreCase),
                    "displayed network diagnostic gives specific " + expected + " guidance");
                using var entry = JsonDocument.Parse(File.ReadLines(path).Last());
                TestCheck.That(entry.RootElement.GetProperty("networkError").GetString() == kind.ToString(),
                    "safe log distinguishes network failure category");
            }
            TestCheck.That(!File.ReadAllText(path).Contains("PRIVATE-EXCEPTION-SENTINEL", StringComparison.Ordinal),
                "network diagnostics never persist raw exception messages");
            var wrapped = new PipelineFailureException("synthetic-network-request", PipelineStage.Locate, 1,
                PipelineCode.Network, new HttpRequestException(HttpRequestError.InvalidResponse,
                    "PRIVATE-PORTAL-SENTINEL", null, HttpStatusCode.ProxyAuthenticationRequired));
            var proxy = AppDiagnostics.Record(FailureStage.ApiRequest, wrapped, path);
            TestCheck.That(proxy.Hint.Contains("proxy", StringComparison.OrdinalIgnoreCase),
                "a pipeline-wrapped proxy failure retains actionable guidance");
            using var proxyEntry = JsonDocument.Parse(File.ReadLines(path).Last());
            TestCheck.That(proxyEntry.RootElement.GetProperty("httpStatus").GetInt32() == 407 &&
                !File.ReadAllText(path).Contains("PRIVATE-PORTAL-SENTINEL", StringComparison.Ordinal),
                "pipeline-wrapped network diagnostics retain status without raw messages");
        }
        finally { if (Directory.Exists(Path.GetDirectoryName(path))) Directory.Delete(Path.GetDirectoryName(path)!, true); }
    }

    private static async Task RedirectIsNotFollowed()
    {
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serve = Serve();
        using var handler = ApiNetwork.CreateHandler();
        handler.UseProxy = false; // Isolate the loopback fixture from the machine's proxy.
        TestCheck.That(handler.ConnectTimeout == TimeSpan.FromSeconds(15), "connection setup has a separate 15-second budget");
        using var client = new HttpClient(handler);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"http://127.0.0.1:{port}/api")
            { Content = new StringContent("SYNTHETIC-TASK") };
        using var response = await client.SendAsync(request, deadline.Token);
        TestCheck.That(response.StatusCode == HttpStatusCode.TemporaryRedirect,
            "production transport returns the redirect instead of posting task data to its destination");
        await serve;

        async Task Serve()
        {
            using var peer = await listener.AcceptTcpClientAsync(deadline.Token);
            using var stream = peer.GetStream();
            using var reader = new StreamReader(stream, Encoding.ASCII, leaveOpen: true);
            while (!string.IsNullOrEmpty(await reader.ReadLineAsync(deadline.Token))) { }
            await stream.WriteAsync(Encoding.ASCII.GetBytes(
                $"HTTP/1.1 307 Temporary Redirect\r\nLocation: http://127.0.0.1:{port}/portal\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), deadline.Token);
        }
    }

    private static async Task BodyTimeoutAndCancellation()
    {
        foreach (var callerCancellation in new[] { false, true })
        {
            using var handler = new StalledBodyHandler();
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromMilliseconds(callerCancellation ? 5000 : 100) };
            using var cancellation = new CancellationTokenSource();
            if (callerCancellation) cancellation.CancelAfter(100);
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses");
            try
            {
                await ApiNetwork.ReadResponseAsync(client, request, "OpenAI", cancellation.Token).WaitAsync(TimeSpan.FromSeconds(3));
                throw new Exception("FAIL: a stalled response body was accepted");
            }
            catch (OperationCanceledException)
            {
                TestCheck.That(handler.Body.Canceled, "response body observes " + (callerCancellation ? "caller cancellation" : "the HTTP timeout"));
            }
            TestCheck.That(handler.Body.Disposed, "timed-out response content is disposed");
        }
    }

    private sealed class StalledBodyHandler : HttpMessageHandler
    {
        public StalledBody Body { get; } = new();
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = Body });
    }

    private sealed class StalledBody : HttpContent
    {
        public bool Canceled { get; private set; }
        public bool Disposed { get; private set; }
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) =>
            throw new Exception("FAIL: response body was read without a cancellation token");
        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context, CancellationToken cancellationToken)
        {
            try { await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken); }
            catch (OperationCanceledException) { Canceled = true; throw; }
        }
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
        protected override void Dispose(bool disposing) { Disposed = true; base.Dispose(disposing); }
    }

    private sealed class NetworkResponseHandler(int status) : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(new HttpResponseMessage((HttpStatusCode)status)
            {
                Content = new StringContent("<html>PRIVATE-PORTAL-SENTINEL</html>", Encoding.UTF8, "TEXT/HTML")
            });
        }
    }
}
