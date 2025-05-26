document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('togglePassword').addEventListener('click', () => {
        togglePassword();
    } );

    function togglePassword() {
        const pwInput = document.getElementById('password');
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';

        document.querySelector("#togglePassword i").classList.toggle("fa-eye");
        document.querySelector("#togglePassword i").classList.toggle("fa-eye-slash");
    }
})