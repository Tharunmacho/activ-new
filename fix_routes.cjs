const fs = require('fs');
const path = require('path');

const filesToUpdateToUnpaid = [
    'website/src/shared/components/EnhancedLoginPage.tsx',
    'website/src/pages/payment/PaymentRegistration.tsx',
    'website/src/pages/payment/PaymentConfirmation.tsx',
    'website/src/pages/member/RegistrationFormShell.tsx',
    'website/src/pages/member/MemberPageShell.tsx',
    'website/src/pages/member/ApplicationSubmitted.tsx',
    'website/src/config/api.config.ts',
    'website/src/shared/services/authService.ts',
    'website/src/services/activApi.ts'
];

for (const file of filesToUpdateToUnpaid) {
    const fullPath = path.join('m:/activ-native-main', file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/'\/member\/dashboard'/g, "'/member/unpaid-dashboard'");
        content = content.replace(/"\/member\/dashboard"/g, '"/member/unpaid-dashboard"');
        content = content.replace(/`\/member\/dashboard`/g, '`/member/unpaid-dashboard`');
        fs.writeFileSync(fullPath, content);
    }
}

// PaymentSuccess should go to paid dashboard
const paymentSuccessPath = 'm:/activ-native-main/website/src/pages/member/PaymentSuccess.tsx';
if (fs.existsSync(paymentSuccessPath)) {
    let content = fs.readFileSync(paymentSuccessPath, 'utf8');
    content = content.replace(/'\/member\/dashboard'/g, "'/payment/member-dashboard'");
    content = content.replace(/"\/member\/dashboard"/g, '"/payment/member-dashboard"');
    fs.writeFileSync(paymentSuccessPath, content);
}

console.log('Fixed hardcoded routes!');
