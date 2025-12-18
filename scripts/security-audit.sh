#!/bin/bash

# Comprehensive Security Audit Script for SaaS School Management Platform
# This script performs automated security checks and generates a detailed report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Audit results
AUDIT_RESULTS=()
SECURITY_SCORE=0
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    SECURITY_SCORE=$((SECURITY_SCORE + 2))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
    SECURITY_SCORE=$((SECURITY_SCORE + 1))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

# Add audit result
add_result() {
    local status="$1"
    local check="$2"
    local details="$3"
    AUDIT_RESULTS+=("$status|$check|$details")
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# Security audit functions
check_environment_security() {
    log_info "Checking environment security..."
    
    # Check .env file permissions
    if [ -f ".env" ]; then
        local perms=$(stat -c "%a" .env 2>/dev/null || stat -f "%A" .env 2>/dev/null)
        if [ "$perms" = "600" ]; then
            log_success "Environment file has secure permissions (600)"
            add_result "PASS" "Environment Permissions" ".env file has secure permissions"
        else
            log_error "Environment file has insecure permissions ($perms)"
            add_result "FAIL" "Environment Permissions" ".env file permissions are $perms (should be 600)"
        fi
    else
        log_warning "No .env file found"
        add_result "WARN" "Environment File" "No .env file found"
    fi
    
    # Check for hardcoded secrets
    if find backend/src -name "*.ts" -exec grep -l "password.*=" {} \; 2>/dev/null | grep -v ".example" | grep -v "template" | grep -v "test" | head -1 >/dev/null; then
        log_error "Hardcoded passwords found in source code"
        add_result "FAIL" "Hardcoded Secrets" "Passwords found in source code"
    else
        log_success "No hardcoded passwords found"
        add_result "PASS" "Hardcoded Secrets" "No hardcoded passwords detected"
    fi
}

check_application_security() {
    log_info "Checking application security..."
    
    # Check for DTO validation files
    if find backend/src -name "*.dto.ts" | head -1 >/dev/null 2>&1; then
        log_success "DTO validation files found"
        add_result "PASS" "Input Validation" "DTO files exist for validation"
    else
        log_warning "No DTO validation files found"
        add_result "WARN" "Input Validation" "No DTO files found"
    fi
    
    # Check for authentication guards
    if find backend/src -name "*guard*.ts" | head -1 >/dev/null 2>&1; then
        log_success "Authentication guards found"
        add_result "PASS" "Authentication Guards" "Guard files exist"
    else
        log_warning "No authentication guards found"
        add_result "WARN" "Authentication Guards" "No guard files found"
    fi
}

check_monitoring_security() {
    log_info "Checking monitoring and alerting security..."
    
    # Check for Prometheus configuration
    if [ -f "monitoring/prometheus/prometheus.yml" ]; then
        log_success "Prometheus configuration found"
        add_result "PASS" "Monitoring Config" "Prometheus config exists"
    else
        log_warning "Prometheus configuration not found"
        add_result "WARN" "Monitoring Config" "Prometheus config missing"
    fi
    
    # Check for alert rules
    if [ -f "monitoring/prometheus/alert_rules.yml" ]; then
        log_success "Prometheus alert rules found"
        add_result "PASS" "Security Alerts" "Alert rules file exists"
        
        # Check for security-specific alerts
        if grep -q "HighFailedLoginAttempts\|SuspiciousAPIActivity" monitoring/prometheus/alert_rules.yml; then
            log_success "Security-specific alerts configured"
            add_result "PASS" "Security Alert Rules" "Security alerts found"
        else
            log_warning "Security-specific alerts not found"
            add_result "WARN" "Security Alert Rules" "No security alerts found"
        fi
    else
        log_warning "Prometheus alert rules not found"
        add_result "WARN" "Security Alerts" "Alert rules file missing"
    fi
    
    # Check for Grafana dashboards
    if [ -d "monitoring/grafana/dashboards" ]; then
        log_success "Grafana dashboards directory found"
        add_result "PASS" "Monitoring Dashboards" "Dashboard directory exists"
    else
        log_warning "Grafana dashboards not found"
        add_result "WARN" "Monitoring Dashboards" "Dashboard directory missing"
    fi
}

check_secrets_management() {
    log_info "Checking secrets management..."
    
    # Check for .gitignore
    if [ -f ".gitignore" ]; then
        if grep -q "\.env" .gitignore; then
            log_success "Environment files ignored in git"
            add_result "PASS" "Git Secrets Protection" ".env files in .gitignore"
        else
            log_error "Environment files not ignored in git"
            add_result "FAIL" "Git Secrets Protection" ".env files not in .gitignore"
        fi
    else
        log_error ".gitignore file not found"
        add_result "FAIL" "Git Configuration" ".gitignore missing"
    fi
}

# Generate security report
generate_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="security-audit-report-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "========================================"
        echo "SECURITY AUDIT REPORT"
        echo "========================================"
        echo "Platform: SaaS School Management Platform"
        echo "Audit Date: $timestamp"
        echo "========================================"
        echo ""
        echo "SUMMARY:"
        echo "--------"
        echo "Total Checks: $TOTAL_CHECKS"
        echo "Passed: $PASSED_CHECKS"
        echo "Warnings: $WARNING_CHECKS"
        echo "Failed: $FAILED_CHECKS"
        echo ""
        
        # Calculate security score percentage
        local max_score=$((TOTAL_CHECKS * 2))
        local score_percentage=$((SECURITY_SCORE * 100 / max_score))
        echo "Security Score: $SECURITY_SCORE/$max_score ($score_percentage%)"
        echo ""
        
        # Security level assessment
        if [ $score_percentage -ge 90 ]; then
            echo "Security Level: EXCELLENT"
        elif [ $score_percentage -ge 80 ]; then
            echo "Security Level: GOOD"
        elif [ $score_percentage -ge 70 ]; then
            echo "Security Level: ACCEPTABLE"
        elif [ $score_percentage -ge 60 ]; then
            echo "Security Level: NEEDS IMPROVEMENT"
        else
            echo "Security Level: CRITICAL - IMMEDIATE ACTION REQUIRED"
        fi
        echo ""
        
        echo "DETAILED RESULTS:"
        echo "-----------------"
        for result in "${AUDIT_RESULTS[@]}"; do
            IFS='|' read -r status check details <<< "$result"
            printf "%-6s %-30s %s\n" "[$status]" "$check" "$details"
        done
        echo ""
        
        echo "RECOMMENDATIONS:"
        echo "----------------"
        if [ $FAILED_CHECKS -gt 0 ]; then
            echo "• Address all FAILED checks immediately"
            echo "• Review and implement missing security configurations"
        fi
        if [ $WARNING_CHECKS -gt 0 ]; then
            echo "• Review WARNING items and implement where applicable"
            echo "• Consider upgrading security measures for better protection"
        fi
        echo "• Regularly run security audits (recommended: weekly)"
        echo "• Keep dependencies updated and monitor for vulnerabilities"
        echo "• Implement security monitoring and alerting"
        echo "• Conduct penetration testing before production deployment"
        echo ""
        
    } | tee "$report_file"
    
    log_info "Security audit report saved to: $report_file"
}

# Main audit execution
main() {
    echo "========================================"
    echo "SaaS School Management Platform"
    echo "Security Audit Tool"
    echo "========================================"
    echo ""
    
    # Run all security checks
    check_environment_security
    check_application_security
    check_monitoring_security
    check_secrets_management
    
    echo ""
    echo "========================================"
    echo "AUDIT COMPLETE"
    echo "========================================"
    
    # Generate comprehensive report
    generate_report
    
    # Final summary
    echo ""
    if [ $FAILED_CHECKS -eq 0 ]; then
        log_success "Security audit completed successfully!"
        echo "✅ All critical security checks passed"
    else
        log_error "Security audit found $FAILED_CHECKS critical issues"
        echo "❌ Please address failed checks before production deployment"
        exit 1
    fi
    
    if [ $WARNING_CHECKS -gt 0 ]; then
        echo "⚠️  $WARNING_CHECKS warnings found - review recommended"
    fi
    
    echo ""
    echo "Security Score: $SECURITY_SCORE/$((TOTAL_CHECKS * 2)) ($(((SECURITY_SCORE * 100) / (TOTAL_CHECKS * 2)))%)"
}

# Run the audit
main "$@"

