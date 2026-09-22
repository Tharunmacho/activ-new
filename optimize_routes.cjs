const fs = require('fs');

const appPath = 'm:/activ-native-main/website/src/App.tsx';
let content = fs.readFileSync(appPath, 'utf8');

// Regex to match lazy imports
const lazyRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\);/g;

// List of components to eager load for performance
const eagerComponents = new Set([
    'UnpaidDashboard',
    'PaymentMemberDashboard',
    'Explore',
    'ProfileView',
    'ApplicationStatus',
    'MemberProfile',
    'MemberSettings',
    'EnhancedLoginPage',
    'MemberRegister',
    'BusinessProfile',
    'BusinessDashboard',
    'Products',
    'Discover',
    'Analytics',
    'BusinessSettings'
]);

content = content.replace(lazyRegex, (match, componentName, importPath) => {
    if (eagerComponents.has(componentName)) {
        return `import ${componentName} from "${importPath}";`;
    }
    return match;
});

fs.writeFileSync(appPath, content);
console.log('Optimized App.tsx routes for speed!');
