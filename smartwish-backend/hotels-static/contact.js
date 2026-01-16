// Contact form functionality
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.querySelector('.contact-form');
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;

    // Email validation function
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Form validation
    function validateForm(formData) {
        const errors = [];
        
        if (!formData.get('firstName').trim()) {
            errors.push('First name is required');
        }
        
        if (!formData.get('lastName').trim()) {
            errors.push('Last name is required');
        }
        
        const email = formData.get('email').trim();
        if (!email) {
            errors.push('Email address is required');
        } else if (!isValidEmail(email)) {
            errors.push('Please enter a valid email address');
        }
        
        if (!formData.get('subject')) {
            errors.push('Please select a subject');
        }
        
        if (!formData.get('message').trim()) {
            errors.push('Message is required');
        }
        
        return errors;
    }

    // Show notification
    function showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Handle form submission
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const errors = validateForm(formData);
        
        if (errors.length > 0) {
            showNotification(errors.join('. '), 'error');
            return;
        }
        
        // Show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        // Send email via backend server
        try {
            const response = await fetch('http://localhost:3001/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    email: formData.get('email'),
                    subject: formData.get('subject'),
                    message: formData.get('message')
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Message sent successfully! We\'ll get back to you soon.', 'success');
                contactForm.reset();
            } else {
                showNotification(result.message || 'Failed to send message. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Email sending error:', error);
            showNotification('Failed to send message. Please check your connection and try again.', 'error');
        }
        
        // Reset button
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    });

    // Real-time email validation
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('blur', function() {
        const email = this.value.trim();
        if (email && !isValidEmail(email)) {
            this.classList.add('error');
            
            // Remove existing error message
            const existingError = this.parentElement.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
            
            // Add error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'field-error';
            errorMessage.textContent = 'Please enter a valid email address';
            this.parentElement.appendChild(errorMessage);
        } else {
            this.classList.remove('error');
            const existingError = this.parentElement.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
        }
    });

    // Remove error styling on input
    const formInputs = contactForm.querySelectorAll('input, select, textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('error');
            const existingError = this.parentElement.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
        });
    });
});