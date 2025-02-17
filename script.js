// FORMAT EMAIL
function isValidEmail(email) {
    if (!email.trim()) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
// FORMAT CONTACT
function formatVCard(name, phone, email, address) {
    let vCard = `BEGIN:VCARD\nVERSION:4.0\nFN:${name}`;
    if (phone.trim()) vCard += `\nTEL:${phone}`;
    if (email.trim()) vCard += `\nEMAIL:${email}`;
    if (address.trim()) vCard += `\nADR:${address}`;
    vCard += `\nEND:VCARD`;
    return vCard;
}
// FORMAT WIFI
function formatWifiCode(ssid, password, hidden) {
    let security = password.trim() ? 'WPA' : 'nopass';
    return `WIFI:S:${ssid};T:${security};P:${password};H:${hidden};`;
}
// FOOTER MESSAGES
function updateFooterMessage(message) {
    document.getElementById('footer-message').innerHTML = message;
}
// NETWORK TOGGLE
function initializeNetworkVisibility() {
    const toggleBox = document.getElementById('network-visibility');
    const hiddenInput = document.getElementById('wifi-hidden');
    if (!toggleBox || !hiddenInput) return;
    toggleBox.addEventListener('click', function() {
        const isHidden = toggleBox.getAttribute('aria-pressed') === 'true';
        toggleBox.setAttribute('aria-pressed', (!isHidden).toString());
        toggleBox.textContent = isHidden ? 'Network: Visible' : 'Network: Hidden';
        hiddenInput.value = (!isHidden).toString();
    });
}
// TAB SWITCHING
function switchInputArea(selectedTab) {
    const linkTextInput = document.getElementById('text-input');
    const contactInfoInputs = document.getElementById('contact-info-inputs');
    const wifiCodeInputs = document.getElementById('wifi-code-inputs');
// HIDE ALL
    linkTextInput.style.display = 'none';
    contactInfoInputs.style.display = 'none';
    wifiCodeInputs.style.display = 'none';
// SHOW SELECTED
    switch (selectedTab) {
        case 'text':
            linkTextInput.style.display = 'block';
            break;
        case 'contact-info':
            contactInfoInputs.style.display = 'flex';
            break;
        case 'wifi-code':
            wifiCodeInputs.style.display = 'flex';
            break;
    }
}
// QR GENERATION
function generateQRCode(qrText, container) {
// CLEAR AREA
    container.innerHTML = '';
    container.classList.add('loading');
    const placeholder = container.querySelector('.placeholder-image');
    if (placeholder) {
        placeholder.remove();
    }
// CREATE IMAGE CANVAS
    const qrWrapper = document.createElement('div');
    qrWrapper.style.opacity = '0';
    qrWrapper.style.transition = 'opacity 0.3s ease-in';
    container.appendChild(qrWrapper);
// CALL OUTSIDE FUNCTION TO GENERATE QR
    new QRCode(qrWrapper, {
        text: qrText,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
        quietZone: 16,
        quietZoneColor: "#ffffff"
    });
// PLACE QR WITHIN BORDERED CANVAS
    const qrImage = qrWrapper.querySelector('img');
    qrImage.onload = function() {
        const canvas = document.createElement('canvas');
        const padding = 32;
        canvas.width = qrImage.width + (padding * 2);
        canvas.height = qrImage.height + (padding * 2);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(qrImage, padding, padding);
// FINALIZED IMAGE
        const paddedImage = new Image();
        paddedImage.style.opacity = '0';
        paddedImage.style.width = '256px';
        paddedImage.style.height = '256px';
        paddedImage.style.transform = 'scale(0.95)';
        paddedImage.style.transition = 'opacity 0.3s ease-in, transform 0.3s ease-out';

// DISPLAY FINAL IMAGE
        paddedImage.onload = function() {
            qrWrapper.remove();
            container.appendChild(paddedImage);
            
            requestAnimationFrame(() => {
                container.classList.remove('loading');
                paddedImage.style.opacity = '1';
                paddedImage.style.transform = 'scale(1)';
            });
        };
// AVAILABLE FOR DOWNLOAD
        paddedImage.src = canvas.toDataURL('image/png');
    };
}
// STARTUP SITE
document.addEventListener('DOMContentLoaded', function() {
    const generateButton = document.getElementById('generate-button');
    const container = document.getElementById('qr-container');
// BUILD TAB STRUCTURE
    document.querySelectorAll('input[name="tab"]').forEach(radio => {
        radio.addEventListener('change', function() {
            switchInputArea(this.value);
        });
    });
    switchInputArea(document.querySelector('input[name="tab"]:checked').value);
    initializeNetworkVisibility();
// GENERATE BUTTON TRIGGER
    generateButton.addEventListener('click', function() {
        const selectedTab = document.querySelector('input[name="tab"]:checked').value;
        let qrText = "";
        const maxLength = 1000;
        try {
            switch (selectedTab) {
                case 'text':
                    const textInput = document.getElementById('text-input').value.trim();
                    if (!textInput) {
                        throw new Error("You need to enter SOMETHING if you want a QR code");
                    }
                    if (textInput.length > maxLength) {
                        throw new Error(`Input is beyond maximum length.  Get below ${maxLength}, hacker`);
                    }
                    qrText = textInput;
                    break;
                case 'contact-info':
                    const name = document.getElementById('contact-name').value.trim();
                    const phone = document.getElementById('contact-phone').value.trim();
                    const email = document.getElementById('contact-email').value.trim();
                    const address = document.getElementById('contact-address').value.trim();
                    if (!name && !phone && !email && !address) {
                        throw new Error("Gotta enter at least one bit of contact information");
                    }
                    if (name.length > 100 || phone.length > 20 || email.length > 100 || address.length > 200) {
                        throw new Error("You're beyond the maximum length, and on top of that you're hacking!");
                    }
                    if (!isValidEmail(email)) {
                        throw new Error("You know Email.  It's gotta be: (name)@(domain).(tld)");
                    }
                    qrText = formatVCard(name, phone, email, address);
                    break;
                case 'wifi-code':
                    const ssid = document.getElementById('wifi-ssid').value;
                    const password = document.getElementById('wifi-password').value;
                    const hidden = document.getElementById('wifi-hidden').value === 'true'; 
                    if (!ssid) {
                        throw new Error("I'll need the network name (SSID)");
                    }
                    if (ssid.length > 32 || password.length > 64) {
                        throw new Error("Your network credentials are impossibly long");
                    }
                    qrText = formatWifiCode(ssid, password, hidden);
                    break;
            }
            generateQRCode(qrText, container);
            updateFooterMessage("QR Code Generated!");
        } catch (error) {
            updateFooterMessage(error.message);
            console.error("QR Code generation error:", error);
            container.classList.remove('loading');
        }
    });
// INITIAL FOOTER MESSAGE
    updateFooterMessage('<a href="https://sandyfletcher.ca" style="color: white; text-decoration: none;">site by sandy</a>');
});