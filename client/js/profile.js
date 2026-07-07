// User Profile Controller

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.toLowerCase().endsWith('profile.html')) return;

  loadProfileInfo();

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordChange);
  }

  // Preview chosen image instantly
  const avatarInput = document.getElementById('profile-picture-input');
  if (avatarInput) {
    avatarInput.addEventListener('change', previewAvatarImage);
  }
});

// 1. Load Profile Settings Data
async function loadProfileInfo() {
  const response = await apiRequest('/auth/profile');
  
  if (response && response.success) {
    const user = response.user;
    
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-address').value = user.address || '';

    // Render avatar
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (avatarPreview) {
      if (user.profile_picture) {
        avatarPreview.src = `http://localhost:5000/uploads/${user.profile_picture}`;
      } else {
        avatarPreview.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150';
      }
    }
  }
}

// 2. Preview selected image
function previewAvatarImage(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const avatarPreview = document.getElementById('profile-avatar-preview');
      if (avatarPreview) {
        avatarPreview.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  }
}

// 3. Handle profile update form submission (multipart/form-data)
async function handleProfileUpdate(e) {
  e.preventDefault();

  const name = document.getElementById('profile-name').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  const address = document.getElementById('profile-address').value.trim();
  const fileInput = document.getElementById('profile-picture-input');

  if (!name) {
    showToast('error', 'Name is required.');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('address', address);

  if (fileInput.files.length > 0) {
    formData.append('profile_picture', fileInput.files[0]);
  }

  const response = await apiRequest('/auth/profile', {
    method: 'PUT',
    body: formData
  });

  if (response && response.success) {
    // Update local storage user information
    localStorage.setItem('user', JSON.stringify(response.user));
    showToast('success', 'Profile updated successfully!');
    
    // Refresh page header avatar if any
    const headerAvatar = document.getElementById('header-avatar');
    if (headerAvatar && response.user.profile_picture) {
      headerAvatar.src = `http://localhost:5000/uploads/${response.user.profile_picture}`;
    }
  } else if (response) {
    showToast('error', response.message || 'Failed to update profile.');
  }
}

// 4. Handle Password change submit
async function handlePasswordChange(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('error', 'Please fill all fields.');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('error', 'New passwords do not match.');
    return;
  }

  const response = await apiRequest('/auth/change-password', {
    method: 'PUT',
    body: { currentPassword, newPassword }
  });

  if (response && response.success) {
    showToast('success', response.message);
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  } else if (response) {
    showToast('error', response.message || 'Password update failed.');
  }
}
