# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| < 5.0   | :x:                |

## Reporting a Vulnerability

This project is a browser extension that interacts with internal BPS (Badan Pusat Statistik) systems. Security is our top priority.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead:

1. **Email**: Send a detailed report to your project maintainer
2. **Include**:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested fixes

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Status Update**: Weekly updates during investigation
- **Resolution Timeline**: We aim to address critical vulnerabilities within 30 days

### Scope of Security Concerns

This extension has access to:
- Browser cookies and session data
- API tokens (JWT)
- User profile information

All handling of sensitive data follows:
- Browser-native storage encryption (Chrome encrypts stored data)
- No credentials hardcoded in source code
- No logging of sensitive information (tokens, passwords)