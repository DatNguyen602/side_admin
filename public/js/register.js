document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('togglePassword').addEventListener('click', () => {
        togglePassword();
    } );

    document.getElementById('sendVerification').addEventListener('click', () => {
        sendVerification();
    });

    function togglePassword() {
        const pwInput = document.getElementById('password');
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';

        document.querySelector("#togglePassword i").classList.toggle("fa-eye");
        document.querySelector("#togglePassword i").classList.toggle("fa-eye-slash");
    }

    async function sendVerification() {
        const email = document.getElementById("email").value;
        await fetch("/mail/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        alert("Mã xác minh đã được gửi!");
    }
})