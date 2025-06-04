document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('togglePassword').addEventListener('click', () => {
        togglePassword();
    } );

    const sendVerificationBtn = document.getElementById('sendVerification')

    if (sendVerificationBtn) {
        sendVerificationBtn?.addEventListener('click', () => {
            sendVerification();
        });
    }

    function togglePassword() {
        const pwInput = document.getElementById('password');
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';

        document.querySelector("#togglePassword i").classList.toggle("fa-eye");
        document.querySelector("#togglePassword i").classList.toggle("fa-eye-slash");
    }

    async function sendVerification() {
        const email = document.getElementById("email").value;
        const loading = document.querySelector("#sendVerification ~ div");
        if(loading) loading.style.display = 'block';
        await fetch("/mail/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        if(loading) loading.style.display = 'none';
        alert("Mã xác minh đã được gửi!");
    }
})