using System.Net;
using System.Net.Http;

namespace SC;

internal static class ApiNetwork
{
    internal static SocketsHttpHandler CreateHandler() => new()
    {
        ConnectTimeout = TimeSpan.FromSeconds(15),
        AllowAutoRedirect = false
    };

    public static HttpClient CreateClient() => new(CreateHandler()) { Timeout = TimeSpan.FromSeconds(90) };

    public static async Task<string> ReadResponseAsync(HttpClient client, HttpRequestMessage request,
        string serviceName, CancellationToken cancellationToken)
    {
        // ResponseHeadersRead lets us reject a sign-in/block page without waiting for its body.
        // Keep the existing request budget over the body read as well as the headers.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        if (client.Timeout != Timeout.InfiniteTimeSpan) deadline.CancelAfter(client.Timeout);
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        var status = (int)response.StatusCode;
        if (status == 407)
            throw NetworkResponse("The network proxy requires authentication. Check Windows proxy settings with university IT.");
        if (status is >= 300 and < 400 or 511)
            throw NetworkResponse("The API request was redirected or requires network sign-in. Sign in to Wi-Fi in a browser, then retry. If it persists, ask university IT to allow the API connection.");
        var mediaType = response.Content.Headers.ContentType?.MediaType;
        if (string.Equals(mediaType, "text/html", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(mediaType, "application/xhtml+xml", StringComparison.OrdinalIgnoreCase))
            throw NetworkResponse("A web page was returned instead of an API response. Sign in to Wi-Fi in a browser, then retry. If access is blocked, ask university IT to allow the API connection.");
        if (!response.IsSuccessStatusCode)
            throw new ApiResponseException(status,
                $"{serviceName} API request failed with status {status}. Check the selected models, key, and quota.");
        return await response.Content.ReadAsStringAsync(deadline.Token);

        HttpRequestException NetworkResponse(string message) =>
            new(HttpRequestError.InvalidResponse, message, null, response.StatusCode);
    }

    public static string? FailureHint(Exception error) => error switch
    {
        HttpRequestException { StatusCode: HttpStatusCode.ProxyAuthenticationRequired } =>
            "The network proxy requires authentication. Ask university IT for the correct Windows proxy setup.",
        HttpRequestException { HttpRequestError: HttpRequestError.NameResolutionError } =>
            "DNS could not resolve the API host. If SC works on a hotspot, ask university IT to check DNS filtering and API access.",
        HttpRequestException { HttpRequestError: HttpRequestError.SecureConnectionError } =>
            "The secure API connection failed (TLS). Check the PC date/time; ask university IT about certificate or HTTPS inspection requirements.",
        HttpRequestException { HttpRequestError: HttpRequestError.ProxyTunnelError or HttpRequestError.UserAuthenticationError } =>
            "The network proxy could not connect to the API. Ask university IT to check proxy authentication and allow HTTPS to the API host.",
        HttpRequestException =>
            "The API connection failed. Sign in to Wi-Fi in a browser and retry. If SC works on a hotspot, ask university IT to allow HTTPS to the selected API host on port 443.",
        OperationCanceledException =>
            "The API request timed out. Retry once. If SC works on a hotspot, ask university IT to check Wi-Fi sign-in, proxy settings, and API access.",
        _ => null
    };
}
