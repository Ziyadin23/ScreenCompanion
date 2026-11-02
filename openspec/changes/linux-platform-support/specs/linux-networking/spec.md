# Spec Delta

## Purpose

Keep provider requests on Linux compatible with SC's established networking and privacy boundaries, including proxy and failure behavior.

## ADDED Requirements

### Requirement: Validated provider transport

Linux provider requests SHALL honor system proxy routing, validate TLS certificates, preserve request bytes, reject automatic redirects and return proxy-authentication or interception failures through the existing diagnostic contracts without exposing credentials or content.

#### Scenario: Provider request uses a proxy

- **WHEN** the system proxy configuration selects a valid route for a provider request
- **THEN** SC follows that route with certificate validation and intact request bytes

#### Scenario: Proxy authentication or interception response

- **WHEN** the proxy or network returns an authentication challenge, redirect or intercepted HTML response
- **THEN** SC reports the applicable failure without following the redirect or forwarding provider credentials to an unintended destination
- **AND** a route fallback does not resend a request after it has already been sent

### Requirement: Bounded cancellable requests

Linux transport SHALL preserve distinct connection and total deadlines, include proxy resolution in connection setup, and cancel outstanding work without leaking response content or transient resources.

#### Scenario: Connection setup or response stalls

- **WHEN** proxy resolution, connection setup or response processing exceeds its applicable deadline
- **THEN** SC ends the operation with the existing bounded timeout diagnostic and releases its resources

#### Scenario: User cancels during response

- **WHEN** cancellation occurs while a request or response body is active
- **THEN** the operation stops promptly, releases its transient buffers/processes and reports cancellation without content-bearing diagnostics
