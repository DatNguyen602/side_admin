// public/js/mail_editor.js

document.addEventListener("DOMContentLoaded", () => {
  const editor = document.getElementById("editor");
  const hiddenInput = document.getElementById("emailContent");
  const toolbar = document.getElementById("toolbar");
  const form = document.querySelector("form");

  // Danh sách lệnh cơ bản
  const commands = [
    { cmd: "undo", label: "↺", title: "Undo" },
    { cmd: "redo", label: "↻", title: "Redo" },
    { cmd: "bold", label: "<b>B</b>", title: "In đậm" },
    { cmd: "italic", label: "<i>I</i>", title: "In nghiêng" },
    { cmd: "underline", label: "<u>U</u>", title: "Gạch chân" },
    { cmd: "strikeThrough", label: "<s>S</s>", title: "Gạch ngang" },
    { cmd: "justifyLeft", label: "🡸", title: "Căn trái" },
    { cmd: "justifyCenter", label: "☉", title: "Căn giữa" },
    { cmd: "justifyRight", label: "🡺", title: "Căn phải" },
    { cmd: "justifyFull", label: "⤫", title: "Căn đều hai bên" },
    { cmd: "insertOrderedList", label: "1.", title: "Danh sách đánh số" },
    { cmd: "insertUnorderedList", label: "•", title: "Danh sách gạch đầu dòng" },
    { cmd: "indent", label: "⮕", title: "Thụt vào" },
    { cmd: "outdent", label: "⮔", title: "Giãn ra" },
    { cmd: "removeFormat", label: "✖", title: "Xóa định dạng" },
    { cmd: "insertBlockquote", label: "❝ ❞", title: "Chèn Blockquote" },
    { cmd: "formatBlock", label: "H1", title: "Định dạng Heading 1", value: "H1" },
    { cmd: "formatBlock", label: "H2", title: "Định dạng Heading 2", value: "H2" },
    { cmd: "formatBlock", label: "H3", title: "Định dạng Heading 3", value: "H3" },
    { cmd: "insertImage", label: "🖼", title: "Chèn ảnh", promptText: "Nhập URL ảnh:" },
    { cmd: "createLink", label: "🔗", title: "Chèn link", promptText: "Nhập URL liên kết:" },
    { cmd: "insertHTML", label: "{ }", title: "Chèn Code Block", value: "<pre><code>Nhập code ở đây...</code></pre>" }
  ];

  // Danh sách color pickers
  const colorPickers = [
    { cmd: "foreColor", label: "A", title: "Màu chữ" },
    { cmd: "hiliteColor", label: "🖍", title: "Màu nền" }
  ];

  // Danh sách font-family (có thể bổ sung thêm nếu cần)
  const fontFamilies = [
    "Arial, sans-serif",
    "Georgia, serif",
    "Tahoma, sans-serif",
    "Times New Roman, serif",
    "Verdana, sans-serif"
  ];

  // Danh sách cỡ chữ
  const fontSizes = [
    { label: "8px", value: "1" },
    { label: "10px", value: "2" },
    { label: "12px", value: "3" },
    { label: "14px", value: "4" },
    { label: "18px", value: "5" },
    { label: "24px", value: "6" },
    { label: "32px", value: "7" }
  ];

  // Hàm thực thi lệnh execCommand với an toàn
  function doCommand(cmdName, value = null) {
    try {
      document.execCommand(cmdName, false, value);
      editor.focus();
      updateHiddenInput();
    } catch (err) {
      console.warn(`Lệnh ${cmdName} không được hỗ trợ:`, err);
    }
  }

  // Tạo dropdown chọn font-family
  const fontSelect = document.createElement("select");
  fontSelect.classList.add("toolbar-select");
  fontSelect.title = "Chọn Font";
  fontFamilies.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.innerText = f.split(",")[0];
    fontSelect.appendChild(opt);
  });
  fontSelect.addEventListener("change", () => {
    doCommand("fontName", fontSelect.value);
  });
  toolbar.appendChild(fontSelect);

  // Tạo dropdown chọn font-size
  const sizeSelect = document.createElement("select");
  sizeSelect.classList.add("toolbar-select");
  sizeSelect.title = "Chọn kích thước chữ";
  fontSizes.forEach(fs => {
    const opt = document.createElement("option");
    opt.value = fs.value;
    opt.innerText = fs.label;
    sizeSelect.appendChild(opt);
  });
  sizeSelect.addEventListener("change", () => {
    doCommand("fontSize", sizeSelect.value);
  });
  toolbar.appendChild(sizeSelect);

  // Tạo nút cho mỗi lệnh trong commands
  commands.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("toolbar-btn");
    btn.innerHTML = item.label;
    btn.title = item.title || item.label;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (item.promptText) {
        const url = window.prompt(item.promptText);
        if (url) {
          doCommand(item.cmd, url);
        }
      } else if (item.value) {
        // formatBlock hoặc insertHTML
        doCommand(item.cmd, item.value);
      } else {
        doCommand(item.cmd);
      }
    });
    toolbar.appendChild(btn);
  });

  // Tạo toolbar cho color pickers
  colorPickers.forEach(item => {
    const wrapper = document.createElement("span");
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.title = item.title;

    const iconBtn = document.createElement("button");
    iconBtn.type = "button";
    iconBtn.classList.add("toolbar-btn");
    iconBtn.innerHTML = item.label;
    iconBtn.title = item.title;
    iconBtn.addEventListener("click", (e) => {
      e.preventDefault();
      colorInput.click();
    });

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = "#000000";
    colorInput.style.width = "0";
    colorInput.style.height = "0";
    colorInput.style.opacity = "0";
    colorInput.style.position = "absolute";
    colorInput.addEventListener("input", (e) => {
      doCommand(item.cmd, e.target.value);
    });

    wrapper.appendChild(iconBtn);
    wrapper.appendChild(colorInput);
    toolbar.appendChild(wrapper);
  });

  // Cập nhật nội dung của editor vào hiddenInput
  function updateHiddenInput() {
    hiddenInput.value = editor.innerHTML;
  }

  ["input", "keyup", "mouseup", "paste"].forEach(evt => {
    editor.addEventListener(evt, updateHiddenInput);
  });

  // Khi submit form, copy nội dung lần cuối
  form.addEventListener("submit", () => {
    updateHiddenInput();
  });

  // Khởi tạo hiddenInput bằng nội dung ban đầu (nếu có)
  updateHiddenInput();
});
