// editor.js - Trình soạn thảo văn bản có đầy đủ chức năng định dạng HTML (nâng cấp)
document.addEventListener("DOMContentLoaded", () => {
  const editor = document.getElementById("editor");
  const hiddenInput = document.getElementById("emailContent");
  const toolbar = document.getElementById("toolbar");
  const form = document.querySelector("form");

  // Danh sách các lệnh định dạng
  const commands = [
    { cmd: "undo", label: "↺" },
    { cmd: "redo", label: "↻" },
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
    { cmd: "removeFormat", label: "✖" },
    // Lệnh chèn link và ảnh sẽ có prompt riêng
    { cmd: "insertLink", label: "🔗", promptText: "Nhập URL liên kết:" },
    { cmd: "insertImage", label: "🖼", promptText: "Nhập URL ảnh:" }
  ];

  // Tạo nút màu chữ và màu nền chữ bằng <input type="color">
  // Chúng ta sẽ tạo 2 input color: foreColor và hiliteColor
  const colorPickers = [
    { cmd: "foreColor", label: "🎨", defaultColor: "#ff0000", title: "Màu chữ" },
    { cmd: "hiliteColor", label: "🖍", defaultColor: "#ffff00", title: "Màu nền" }
  ];

  // Hàm thực thi lệnh execCommand với an toàn
  function doCommand(cmdName, value = null) {
    try {
      document.execCommand(cmdName, false, value);
      editor.focus(); // Giữ focus vào vùng soạn thảo
      updateHiddenInput();
    } catch (err) {
      console.warn(`Lệnh ${cmdName} không được hỗ trợ:`, err);
    }
  }

  // Tạo toolbar cho các lệnh thông thường (buttons)
  commands.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("toolbar-btn");
    btn.innerHTML = item.label;
    btn.title = item.promptText || item.label;
    btn.addEventListener("click", e => {
      e.preventDefault();
      if (item.promptText) {
        const url = window.prompt(item.promptText);
        if (url) {
          doCommand(item.cmd, url);
        }
      } else {
        doCommand(item.cmd);
      }
    });
    toolbar.appendChild(btn);
  });

  // Tạo toolbar cho color pickers
  colorPickers.forEach(item => {
    // Tạo một container nhỏ để chứa icon và input[type=color]
    const wrapper = document.createElement("span");
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.title = item.title;

    const iconBtn = document.createElement("button");
    iconBtn.type = "button";
    iconBtn.classList.add("toolbar-btn");
    iconBtn.innerHTML = item.label;
    iconBtn.addEventListener("click", e => {
      e.preventDefault();
      colorInput.click(); // Mở input color khi click vào icon
    });

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = item.defaultColor;
    colorInput.style.width = "0";
    colorInput.style.height = "0";
    colorInput.style.opacity = "0";
    colorInput.style.position = "absolute";
    colorInput.addEventListener("input", e => {
      doCommand(item.cmd, e.target.value);
    });

    wrapper.appendChild(iconBtn);
    wrapper.appendChild(colorInput);
    toolbar.appendChild(wrapper);
  });

  // Cập nhật nội dung của editor vào hiddenInput (khi người dùng gõ, dán, nhấp)
  function updateHiddenInput() {
    hiddenInput.value = editor.innerHTML;
  }

  // Lắng nghe tất cả sự kiện thay đổi của vùng soạn thảo
  ["input", "keyup", "mouseup", "paste"].forEach(evt => {
    editor.addEventListener(evt, updateHiddenInput);
  });

  // Trường hợp submit form, chắc chắn copy nội dung lần cuối
  form.addEventListener("submit", () => {
    updateHiddenInput();
  });

  // Khởi tạo hiddenInput bằng nội dung ban đầu (nếu có)
  updateHiddenInput();
});
