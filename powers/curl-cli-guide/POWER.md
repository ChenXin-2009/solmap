---
name: "curl-cli-guide"
displayName: "cURL CLI Guide"
description: "Complete guide for using cURL command-line tool for HTTP requests, file transfers, and API testing with practical examples and troubleshooting."
keywords: ["curl", "http", "api", "cli", "requests", "download", "upload"]
author: "Kiro Power Builder Example"
---

# cURL CLI Guide

## Overview

cURL is a powerful command-line tool for transferring data with URLs. It supports numerous protocols including HTTP, HTTPS, FTP, and more. This guide covers installation, common usage patterns, and troubleshooting for everyday HTTP requests and API interactions.

Whether you're testing APIs, downloading files, or debugging web services, cURL provides the flexibility and control you need from the command line.

## Onboarding

### Installation

#### Windows
```bash
# cURL comes pre-installed on Windows 10+ 
curl --version

# Or install via Chocolatey
choco install curl

# Or download from: https://curl.se/windows/
```

#### macOS
```bash
# Pre-installed on macOS
curl --version

# Or install via Homebrew
brew install curl
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get install curl

# CentOS/RHEL
sudo yum install curl

# Arch Linux
sudo pacman -S curl
```

### Prerequisites
- No special prerequisites - works on all major operating systems
- For HTTPS requests: SSL/TLS support (included in modern installations)

### Verification
```bash
# Verify installation
curl --version

# Expected output:
curl 7.68.0 (x86_64-pc-linux-gnu) libcurl/7.68.0
Release-Date: 2020-01-08
Protocols: dict file ftp ftps gopher http https imap imaps ldap ldaps pop3 pop3s rtmp rtsp scp sftp smb smbs smtp smtps telnet tftp
Features: AsynchDNS brotli GSS-API HTTP2 HTTPS-proxy IDN IPv6 Kerberos Largefile libz NTLM NTLM_WB PSL SPNEGO SSL TLS-SRP UnixSockets zstd
```

## Common Workflows

### Workflow: Basic HTTP Requests

**Goal:** Make simple GET, POST, PUT, DELETE requests

**Commands:**
```bash
# GET request
curl https://api.example.com/users

# GET with headers
curl -H "Accept: application/json" https://api.example.com/users

# POST with JSON data
curl -X POST -H "Content-Type: application/json" \
     -d '{"name":"John","email":"john@example.com"}' \
     https://api.example.com/users

# PUT request
curl -X PUT -H "Content-Type: application/json" \
     -d '{"name":"John Updated"}' \
     https://api.example.com/users/123

# DELETE request
curl -X DELETE https://api.example.com/users/123
```

**Complete Example:**
```bash
# Test a REST API endpoint
curl -X GET \
     -H "Accept: application/json" \
     -H "Authorization: Bearer your-token-here" \
     https://jsonplaceholder.typicode.com/posts/1

# Expected response:
{
  "userId": 1,
  "id": 1,
  "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
  "body": "quia et suscipit..."
}
```

### Workflow: File Operations

**Goal:** Download and upload files

**Commands:**
```bash
# Download file
curl -O https://example.com/file.zip

# Download with custom filename
curl -o myfile.zip https://example.com/file.zip

# Download with progress bar
curl --progress-bar -O https://example.com/largefile.zip

# Upload file via POST
curl -X POST -F "file=@/path/to/file.txt" https://api.example.com/upload

# Upload multiple files
curl -X POST \
     -F "file1=@document.pdf" \
     -F "file2=@image.jpg" \
     https://api.example.com/upload
```

### Workflow: Authentication & Headers

**Goal:** Handle various authentication methods

**Commands:**
```bash
# Basic authentication
curl -u username:password https://api.example.com/protected

# Bearer token
curl -H "Authorization: Bearer your-jwt-token" https://api.example.com/protected

# API key in header
curl -H "X-API-Key: your-api-key" https://api.example.com/data

# Custom headers
curl -H "User-Agent: MyApp/1.0" \
     -H "Accept: application/json" \
     https://api.example.com/data
```

## Command Reference

### curl

**Purpose:** Transfer data from or to servers using various protocols

**Syntax:**
```bash
curl [options] [URL...]
```

**Common Options:**
| Flag | Description | Example |
|------|-------------|---------|
| `-X, --request` | HTTP method | `-X POST` |
| `-H, --header` | Add header | `-H "Content-Type: application/json"` |
| `-d, --data` | Send data | `-d '{"key":"value"}'` |
| `-o, --output` | Write output to file | `-o filename.txt` |
| `-O, --remote-name` | Use remote filename | `-O` |
| `-u, --user` | Authentication | `-u user:pass` |
| `-v, --verbose` | Verbose output | `-v` |
| `-s, --silent` | Silent mode | `-s` |
| `-f, --fail` | Fail silently on errors | `-f` |
| `-L, --location` | Follow redirects | `-L` |

**Examples:**
```bash
# Verbose request with redirect following
curl -v -L https://example.com

# Silent request that fails on HTTP errors
curl -s -f https://api.example.com/data

# Save response headers to file
curl -D headers.txt https://example.com
```

## Troubleshooting

### Error: "curl: command not found"
**Cause:** cURL not installed or not in PATH
**Solution:**
1. Install cURL using your system's package manager
2. Verify installation: `curl --version`
3. Restart terminal if needed

### Error: "SSL certificate problem"
**Cause:** SSL certificate verification failed
**Solution:**
1. **Recommended:** Fix the certificate issue on the server
2. **For testing only:** Skip verification with `-k` flag:
   ```bash
   curl -k https://example.com
   ```
3. Specify CA bundle:
   ```bash
   curl --cacert /path/to/ca-bundle.crt https://example.com
   ```

### Error: "Connection refused" or "Connection timeout"
**Cause:** Server not reachable or firewall blocking
**Solution:**
1. Check URL spelling and port number
2. Test with a simple request: `curl -v https://google.com`
3. Check firewall settings
4. Try with different timeout: `curl --connect-timeout 30 https://example.com`

### Error: "HTTP 401 Unauthorized"
**Cause:** Authentication required or invalid credentials
**Solution:**
1. Verify authentication method required by API
2. Check credentials are correct
3. Ensure proper header format:
   ```bash
   # Basic auth
   curl -u username:password https://api.example.com
   
   # Bearer token
   curl -H "Authorization: Bearer token" https://api.example.com
   ```

### Error: "HTTP 403 Forbidden"
**Cause:** Valid credentials but insufficient permissions
**Solution:**
1. Verify account has required permissions
2. Check if API key has proper scope
3. Contact API provider for access

## Best Practices

- **Use verbose mode (-v) for debugging** - Shows request/response headers and connection details
- **Follow redirects with -L** - Many APIs redirect HTTP to HTTPS
- **Set appropriate timeouts** - Use `--connect-timeout` and `--max-time` for reliability
- **Handle errors gracefully** - Use `-f` flag to fail on HTTP errors in scripts
- **Store sensitive data securely** - Use environment variables instead of hardcoding tokens
- **Use configuration files** - Create `.curlrc` for frequently used options
- **Test with simple requests first** - Start with GET requests before complex operations

## Configuration

**No additional configuration required** - cURL works out of the box after installation.

**Optional Configuration File (~/.curlrc):**
```bash
# Default options for all curl commands
user-agent = "MyApp/1.0"
connect-timeout = 30
max-time = 300
location
```

## Additional Resources

- Official Documentation: https://curl.se/docs/
- Manual Page: `man curl`
- Everything cURL Book: https://everything.curl.dev/
- cURL Cookbook: https://catonmat.net/cookbooks/curl

---

**CLI Tool:** `curl`
**Installation:** Pre-installed on most systems or via package manager