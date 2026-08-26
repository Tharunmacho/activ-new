# Clear Old LocalStorage Data

This document explains how to clear old cached data from your browser.

## Why Clear Data?

The application has been updated to use MongoDB for all data storage. Previously, some data was stored in browser localStorage, which may cause conflicts with the new database-driven approach.

## How to Clear LocalStorage

### Method 1: Using Browser DevTools
1. Open your browser's Developer Tools (F12 or Right-click → Inspect)
2. Go to the "Application" or "Storage" tab
3. Find "Local Storage" in the left sidebar
4. Click on your site (http://localhost:8080)
5. Right-click and select "Clear" or click the clear icon
6. Refresh the page (F5)

### Method 2: Using Browser Console
1. Open Developer Tools (F12)
2. Go to the "Console" tab
3. Type the following command and press Enter:
   ```javascript
   localStorage.clear()
   ```
4. Refresh the page (F5)

### What Gets Cleared?
The following old data will be removed:
- `businessProfile` - Old business profile data (now in `companies` collection)
- `businessProducts` - Old product data (now in `products` collection)
- Any other cached business data

### What Stays?
Your login token will remain, so you won't be logged out.

## After Clearing

After clearing localStorage:
1. Refresh the page
2. All data will be loaded fresh from MongoDB
3. Dashboard will show real company and product counts
4. Products list will show products from database
5. Companies list will show companies from database

## Verify Data is Loading Correctly

Check these pages to confirm data is loading from MongoDB:
- **Business Dashboard** (`/business/dashboard`)
  - Should show company count from database
  - Should show product count from database
  - Recent activity should show real products
  
- **Products Page** (`/business/products`)
  - Should show products from `products` collection
  - Products should have MongoDB `_id` fields
  
- **My Companies** (`/business/companies`)
  - Should show companies from `companies` collection
  - Should show active company indicator

## Troubleshooting

If you still see old data:
1. Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache completely
3. Try in incognito/private window
4. Check browser console for errors
