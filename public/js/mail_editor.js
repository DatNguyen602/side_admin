// editor.js - Trình soạn thảo văn bản có đầy đủ chức năng định dạng HTML

document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editor");
    const hiddenInput = document.getElementById("emailContent");
    
    // Danh sách các chức năng định dạng
    const commands = [
        { cmd: "bold", label: "B" },
        { cmd: "italic", label: "I" },
        { cmd: "underline", label: "U" },
        { cmd: "strikeThrough", label: "S" },
        { cmd: "justifyLeft", label: "🡨" },
        { cmd: "justifyCenter", label: "☉" },
        { cmd: "justifyRight", label: "🡪" },
        { cmd: "justifyFull", label: "⤪" },
        { cmd: "insertOrderedList", label: "1." },
        { cmd: "insertUnorderedList", label: "•" },
        { cmd: "indent", label: "⮕" },
        { cmd: "outdent", label: "⮔" },
        { cmd: "foreColor", label: "🎨", value: "#ff0000" }, // Đổi màu chữ
        { cmd: "hiliteColor", label: "🖍", value: "#ffff00" }, // Đổi màu nền chữ
        { cmd: "insertLink", label: "🔗", prompt: "Nhập URL" }, // Chèn link
        { cmd: "insertImage", label: "🖼", prompt: "Nhập URL ảnh" }, // Chèn ảnh
        { cmd: "removeFormat", label: "✖" } // Xóa định dạng
    ];

    // Render thanh công cụ
    const toolbar = document.getElementById("toolbar");
    commands.forEach(({ cmd, label, value, prompt }) => {
        const btn = document.createElement("button");
        btn.innerHTML = label;
        btn.classList.add("toolbar-btn");
        btn.onclick = () => {
            event.preventDefault();
            if (prompt) {
                let userInput = prompt(prompt);
                if (userInput) document.execCommand(cmd, false, userInput);
            } else {
                document.execCommand(cmd, false, value || null);
            }
            console.log(hiddenInput.value);
        };
        toolbar.appendChild(btn);
    });

    // Cập nhật nội dung vào input ẩn để gửi form
    document.querySelector("form").onsubmit = function() {
        hiddenInput.value = editor.innerHTML;
    };
});
