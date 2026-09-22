# Location Dropdown Integration for Website

## 🎯 Problem Solved
Your website now has access to the same State, District, and Block dropdown data that your mobile app uses!

---

## 🌐 API Endpoints Available

### Base URL
- **Development**: `http://10.191.174.174:3000/api/locations`
- **Production**: `https://actv-project.onrender.com/api/locations`

### Endpoints

#### 1. Get All States
```
GET /api/locations/states
```

**Response:**
```json
{
  "success": true,
  "data": [
    "Andaman And Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    // ... more states
  ]
}
```

#### 2. Get Districts for a State
```
GET /api/locations/states/:stateName/districts
```

**Example:**
```
GET /api/locations/states/Tamil%20Nadu/districts
```

**Response:**
```json
{
  "success": true,
  "data": [
    "Ariyalur",
    "Chengalpattu",
    "Chennai",
    "Coimbatore",
    "Cuddalore",
    // ... more districts
  ]
}
```

#### 3. Get Blocks for a District
```
GET /api/locations/states/:stateName/districts/:districtName/blocks
```

**Example:**
```
GET /api/locations/states/Tamil%20Nadu/districts/Tiruvannamalai/blocks
```

**Response:**
```json
{
  "success": true,
  "data": [
    "Anakkavur",
    "Arni",
    "Chetpet",
    "Chengam",
    "Kalasapakkam",
    "Keelpennathur",
    // ... more blocks
  ]
}
```

#### 4. Get Complete Location Data (Optional)
```
GET /api/locations/all
```

**Response:** Complete nested JSON structure with all states, districts, and blocks

---

## 💻 Frontend Implementation

### React/Next.js Example

```javascript
import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://10.191.174.174:3000/api';

export default function RegistrationForm() {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  
  const [loading, setLoading] = useState({
    states: false,
    districts: false,
    blocks: false
  });

  // Load states on component mount
  useEffect(() => {
    fetchStates();
  }, []);

  // Fetch states
  const fetchStates = async () => {
    setLoading(prev => ({ ...prev, states: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/locations/states`);
      const data = await response.json();
      
      if (data.success) {
        setStates(data.data);
      }
    } catch (error) {
      console.error('Error fetching states:', error);
    } finally {
      setLoading(prev => ({ ...prev, states: false }));
    }
  };

  // Fetch districts when state changes
  useEffect(() => {
    if (selectedState) {
      fetchDistricts(selectedState);
    } else {
      setDistricts([]);
      setBlocks([]);
      setSelectedDistrict('');
      setSelectedBlock('');
    }
  }, [selectedState]);

  const fetchDistricts = async (stateName) => {
    setLoading(prev => ({ ...prev, districts: true }));
    try {
      const encodedState = encodeURIComponent(stateName);
      const response = await fetch(`${API_BASE_URL}/locations/states/${encodedState}/districts`);
      const data = await response.json();
      
      if (data.success) {
        setDistricts(data.data);
      }
    } catch (error) {
      console.error('Error fetching districts:', error);
    } finally {
      setLoading(prev => ({ ...prev, districts: false }));
    }
  };

  // Fetch blocks when district changes
  useEffect(() => {
    if (selectedState && selectedDistrict) {
      fetchBlocks(selectedState, selectedDistrict);
    } else {
      setBlocks([]);
      setSelectedBlock('');
    }
  }, [selectedState, selectedDistrict]);

  const fetchBlocks = async (stateName, districtName) => {
    setLoading(prev => ({ ...prev, blocks: true }));
    try {
      const encodedState = encodeURIComponent(stateName);
      const encodedDistrict = encodeURIComponent(districtName);
      const response = await fetch(
        `${API_BASE_URL}/locations/states/${encodedState}/districts/${encodedDistrict}/blocks`
      );
      const data = await response.json();
      
      if (data.success) {
        setBlocks(data.data);
      }
    } catch (error) {
      console.error('Error fetching blocks:', error);
    } finally {
      setLoading(prev => ({ ...prev, blocks: false }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const formData = {
      state: selectedState,
      district: selectedDistrict,
      block: selectedBlock
    };
    
    console.log('Form Data:', formData);
    // Submit to your backend
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>State *</label>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          disabled={loading.states}
          required
        >
          <option value="">Select state</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>District *</label>
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          disabled={!selectedState || loading.districts}
          required
        >
          <option value="">
            {selectedState ? 'Select district' : 'Select state first'}
          </option>
          {districts.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Block *</label>
        <select
          value={selectedBlock}
          onChange={(e) => setSelectedBlock(e.target.value)}
          disabled={!selectedDistrict || loading.blocks}
          required
        >
          <option value="">
            {selectedDistrict ? 'Select block' : 'Select district first'}
          </option>
          {blocks.map((block) => (
            <option key={block} value={block}>
              {block}
            </option>
          ))}
        </select>
      </div>

      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## 🎨 Vanilla JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Registration Form</title>
</head>
<body>
  <form id="registrationForm">
    <div>
      <label>State *</label>
      <select id="stateSelect" required>
        <option value="">Select state</option>
      </select>
    </div>

    <div>
      <label>District *</label>
      <select id="districtSelect" required disabled>
        <option value="">Select state first</option>
      </select>
    </div>

    <div>
      <label>Block *</label>
      <select id="blockSelect" required disabled>
        <option value="">Select district first</option>
      </select>
    </div>

    <button type="submit">Submit</button>
  </form>

  <script>
    const API_BASE_URL = 'http://10.191.174.174:3000/api';

    const stateSelect = document.getElementById('stateSelect');
    const districtSelect = document.getElementById('districtSelect');
    const blockSelect = document.getElementById('blockSelect');

    // Load states on page load
    loadStates();

    async function loadStates() {
      try {
        const response = await fetch(`${API_BASE_URL}/locations/states`);
        const data = await response.json();

        if (data.success) {
          stateSelect.innerHTML = '<option value="">Select state</option>';
          data.data.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            stateSelect.appendChild(option);
          });
        }
      } catch (error) {
        console.error('Error loading states:', error);
      }
    }

    // State change handler
    stateSelect.addEventListener('change', async function() {
      const selectedState = this.value;
      
      // Reset dependent dropdowns
      districtSelect.innerHTML = '<option value="">Loading...</option>';
      districtSelect.disabled = true;
      blockSelect.innerHTML = '<option value="">Select district first</option>';
      blockSelect.disabled = true;

      if (!selectedState) {
        districtSelect.innerHTML = '<option value="">Select state first</option>';
        return;
      }

      try {
        const encodedState = encodeURIComponent(selectedState);
        const response = await fetch(`${API_BASE_URL}/locations/states/${encodedState}/districts`);
        const data = await response.json();

        if (data.success) {
          districtSelect.innerHTML = '<option value="">Select district</option>';
          data.data.forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            districtSelect.appendChild(option);
          });
          districtSelect.disabled = false;
        }
      } catch (error) {
        console.error('Error loading districts:', error);
        districtSelect.innerHTML = '<option value="">Error loading districts</option>';
      }
    });

    // District change handler
    districtSelect.addEventListener('change', async function() {
      const selectedState = stateSelect.value;
      const selectedDistrict = this.value;
      
      // Reset blocks
      blockSelect.innerHTML = '<option value="">Loading...</option>';
      blockSelect.disabled = true;

      if (!selectedDistrict) {
        blockSelect.innerHTML = '<option value="">Select district first</option>';
        return;
      }

      try {
        const encodedState = encodeURIComponent(selectedState);
        const encodedDistrict = encodeURIComponent(selectedDistrict);
        const response = await fetch(
          `${API_BASE_URL}/locations/states/${encodedState}/districts/${encodedDistrict}/blocks`
        );
        const data = await response.json();

        if (data.success) {
          blockSelect.innerHTML = '<option value="">Select block</option>';
          data.data.forEach(block => {
            const option = document.createElement('option');
            option.value = block;
            option.textContent = block;
            blockSelect.appendChild(option);
          });
          blockSelect.disabled = false;
        }
      } catch (error) {
        console.error('Error loading blocks:', error);
        blockSelect.innerHTML = '<option value="">Error loading blocks</option>';
      }
    });

    // Form submit handler
    document.getElementById('registrationForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = {
        state: stateSelect.value,
        district: districtSelect.value,
        block: blockSelect.value
      };
      
      console.log('Submitted data:', formData);
      // Send to your backend API
    });
  </script>
</body>
</html>
```

---

## 🔄 jQuery Example

```javascript
$(document).ready(function() {
  const API_BASE_URL = 'http://10.191.174.174:3000/api';

  // Load states
  loadStates();

  function loadStates() {
    $.ajax({
      url: `${API_BASE_URL}/locations/states`,
      method: 'GET',
      success: function(response) {
        if (response.success) {
          $('#stateSelect').html('<option value="">Select state</option>');
          response.data.forEach(function(state) {
            $('#stateSelect').append(`<option value="${state}">${state}</option>`);
          });
        }
      },
      error: function(error) {
        console.error('Error loading states:', error);
      }
    });
  }

  // State change
  $('#stateSelect').on('change', function() {
    const selectedState = $(this).val();
    
    if (!selectedState) {
      $('#districtSelect').html('<option value="">Select state first</option>').prop('disabled', true);
      $('#blockSelect').html('<option value="">Select district first</option>').prop('disabled', true);
      return;
    }

    $('#districtSelect').html('<option value="">Loading...</option>').prop('disabled', true);
    $('#blockSelect').html('<option value="">Select district first</option>').prop('disabled', true);

    $.ajax({
      url: `${API_BASE_URL}/locations/states/${encodeURIComponent(selectedState)}/districts`,
      method: 'GET',
      success: function(response) {
        if (response.success) {
          $('#districtSelect').html('<option value="">Select district</option>');
          response.data.forEach(function(district) {
            $('#districtSelect').append(`<option value="${district}">${district}</option>`);
          });
          $('#districtSelect').prop('disabled', false);
        }
      },
      error: function(error) {
        console.error('Error loading districts:', error);
      }
    });
  });

  // District change
  $('#districtSelect').on('change', function() {
    const selectedState = $('#stateSelect').val();
    const selectedDistrict = $(this).val();
    
    if (!selectedDistrict) {
      $('#blockSelect').html('<option value="">Select district first</option>').prop('disabled', true);
      return;
    }

    $('#blockSelect').html('<option value="">Loading...</option>').prop('disabled', true);

    $.ajax({
      url: `${API_BASE_URL}/locations/states/${encodeURIComponent(selectedState)}/districts/${encodeURIComponent(selectedDistrict)}/blocks`,
      method: 'GET',
      success: function(response) {
        if (response.success) {
          $('#blockSelect').html('<option value="">Select block</option>');
          response.data.forEach(function(block) {
            $('#blockSelect').append(`<option value="${block}">${block}</option>`);
          });
          $('#blockSelect').prop('disabled', false);
        }
      },
      error: function(error) {
        console.error('Error loading blocks:', error);
      }
    });
  });
});
```

---

## ✅ Testing the API

Test from your browser console or terminal:

```bash
# Get all states
curl http://10.191.174.174:3000/api/locations/states

# Get districts for Tamil Nadu
curl http://10.191.174.174:3000/api/locations/states/Tamil%20Nadu/districts

# Get blocks for Tiruvannamalai
curl "http://10.191.174.174:3000/api/locations/states/Tamil%20Nadu/districts/Tiruvannamalai/blocks"
```

---

## 🎯 Key Features

✅ **Same Data as Mobile App** - Exact same location data  
✅ **Cached** - Responses cached for 1 hour for fast loading  
✅ **No Database Queries** - Loads from JSON file  
✅ **URL Encoded** - Handles spaces and special characters properly  
✅ **Error Handling** - Returns proper error messages  
✅ **Production Ready** - Works on both local and production URLs  

---

## 🚀 Next Steps

1. **Copy one of the examples above** to your website
2. **Update API_BASE_URL** to match your environment:
   - Development: `http://10.191.174.174:3000/api`
   - Production: `https://actv-project.onrender.com/api`
3. **Test the dropdowns** - They should now populate with data!
4. **Style as needed** - Add CSS to match your design

Your website now has the same location dropdown functionality as your mobile app! 🎉
