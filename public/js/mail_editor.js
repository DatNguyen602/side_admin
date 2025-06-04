// public/js/mail_editor.js

document.addEventListener("DOMContentLoaded", () => {
  const editor = document.getElementById("editor");
  const hiddenInput = document.getElementById("emailContent");
  const toolbar = document.getElementById("toolbar");
  const form = document.querySelector("form");
  const charCountEl = document.getElementById("char-count");
  const wordCountEl = document.getElementById("word-count");

  // Danh sách lệnh cơ bản
  const commands = [
    { cmd: "undo", label: "↺", title: "Undo (Ctrl+Z)" },
    { cmd: "redo", label: "↻", title: "Redo (Ctrl+Y)" },
    { cmd: "bold", label: "<b>B</b>", title: "In đậm (Ctrl+B)" },
    { cmd: "italic", label: "<i>I</i>", title: "In nghiêng (Ctrl+I)" },
    { cmd: "underline", label: "<u>U</u>", title: "Gạch chân (Ctrl+U)" },
    { cmd: "strikeThrough", label: "<s>S</s>", title: "Gạch ngang" },
    { cmd: "justifyLeft", label: "🡸", title: "Căn trái" },
    { cmd: "justifyCenter", label: "☉", title: "Căn giữa" },
    { cmd: "justifyRight", label: "🡺", title: "Căn phải" },
    { cmd: "justifyFull", label: "⤫", title: "Căn đều hai bên" },
    { cmd: "insertOrderedList", label: "1.", title: "Danh sách đánh số" },
    { cmd: "insertUnorderedList", label: "•", title: "Danh sách gạch đầu dòng" },
    { cmd: "indent", label: "⮕", title: "Thụt đầu dòng" },
    { cmd: "outdent", label: "⮔", title: "Giãn đoạn" },
    { cmd: "removeFormat", label: "✖", title: "Xóa định dạng" },
    { cmd: "insertBlockquote", label: "❝❞", title: "Chèn Blockquote" },
    { cmd: "formatBlock", label: "H1", title: "Heading 1", value: "H1" },
    { cmd: "formatBlock", label: "H2", title: "Heading 2", value: "H2" },
    { cmd: "formatBlock", label: "H3", title: "Heading 3", value: "H3" },
    { cmd: "insertImage", label: "🖼", title: "Chèn ảnh", promptText: "Nhập URL ảnh:" },
    { cmd: "createLink", label: "🔗", title: "Chèn link", promptText: "Nhập URL liên kết:" },
    { cmd: "insertHTML", label: "{ }", title: "Chèn Code Block", value: "<pre><code>Nhập code ...</code></pre>" }
  ];

  // Danh sách color pickers
  const colorPickers = [
    { cmd: "foreColor", label: "A", title: "Màu chữ" },
    { cmd: "hiliteColor", label: "🖍", title: "Màu nền" }
  ];

  // Danh sách font-family
  const fontFamilies = [
    "Arial, sans-serif",
    "Georgia, serif",
    "Tahoma, sans-serif",
    "Times New Roman, serif",
    "Verdana, sans-serif"
  ];

  // Danh sách font-size (1–7)
  const fontSizes = [
    { label: "8px", value: "1" },
    { label: "10px", value: "2" },
    { label: "12px", value: "3" },
    { label: "14px", value: "4" },
    { label: "18px", value: "5" },
    { label: "24px", value: "6" },
    { label: "32px", value: "7" }
  ];

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

  //preview
  const previewEmailBtn = document.querySelector("#previewEmail");
  function previewEmail() {
    const html = document.getElementById('editor').innerHTML;
    const win = window.open("", "_blank", "width=800,height=600");
    win.document.write("<html><head><title>Xem trước Email</title></head><body>");
    win.document.write(html);
    win.document.write("</body></html>");
    win.document.close();
  }
  if(previewEmailBtn) {
    previewEmailBtn.addEventListener('click', () => {
        previewEmail();
    });
  }

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

  // Dropdown “More” để chứa các lệnh khi không đủ chỗ
  const moreDropdown = document.createElement("div");
  moreDropdown.id = "more-dropdown";
  moreDropdown.style.display = "inline-block";
  moreDropdown.style.position = "relative";

  const moreBtn = document.createElement("button");
  moreBtn.id = "more-dropdown-btn";
  moreBtn.type = "button";
  moreBtn.innerHTML = "⋯";
  moreBtn.title = "Thêm";
  moreDropdown.appendChild(moreBtn);

  const moreContent = document.createElement("div");
  moreContent.id = "more-dropdown-content";
  moreDropdown.appendChild(moreContent);

  toolbar.appendChild(moreDropdown);

  // Hàm thực thi execCommand
  function doCommand(cmdName, value = null) {
    try {
      document.execCommand(cmdName, false, value);
      editor.focus();
      updateHiddenInput();
      updateActiveStates();
      updateDropdownValues();
      updateCounter();
    } catch (err) {
      console.warn(`Lệnh ${cmdName} không được hỗ trợ:`, err);
    }
  }

  // Tạo nút cho mỗi lệnh; nếu toolbar full, sẽ chuyển vào “More”
  commands.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("toolbar-btn");
    btn.innerHTML = item.label;
    btn.title = item.title;
    btn.dataset.cmd = item.cmd;
    if (item.value) btn.dataset.value = item.value;
    if (item.promptText) btn.dataset.prompt = item.promptText;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.dataset.prompt) {
        const url = window.prompt(btn.dataset.prompt);
        if (url) doCommand(item.cmd, url);
      } else if (btn.dataset.value) {
        doCommand(item.cmd, btn.dataset.value);
      } else {
        doCommand(item.cmd);
      }
    });

    toolbar.insertBefore(btn, moreDropdown);
  });

  // Các nút color picker
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
    iconBtn.dataset.cmd = item.cmd;

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = "#000000";
    colorInput.style.width = "0";
    colorInput.style.height = "0";
    colorInput.style.opacity = "0";
    colorInput.style.position = "absolute";

    iconBtn.addEventListener("click", (e) => {
      e.preventDefault();
      colorInput.click();
    });
    colorInput.addEventListener("input", (e) => {
      doCommand(item.cmd, e.target.value);
    });

    wrapper.appendChild(iconBtn);
    wrapper.appendChild(colorInput);
    toolbar.insertBefore(wrapper, moreDropdown);
  });

  // Cập nhật nội dung hiddenInput
  function updateHiddenInput() {
    hiddenInput.value = editor.innerHTML;
  }

  // Cập nhật số ký tự và số từ
  function updateCounter() {
    const text = editor.innerText.trim();
    const chars = editor.innerText.length;
    const words = text === "" ? 0 : text.split(/\s+/).length;
    charCountEl.innerText = `Ký tự: ${chars}`;
    wordCountEl.innerText = `Từ: ${words}`;
  }

  // Cập nhật trạng thái active cho các nút toolbar
  function updateActiveStates() {
    const btns = toolbar.querySelectorAll(".toolbar-btn");
    btns.forEach(btn => {
      const cmd = btn.dataset.cmd;
      if (!cmd) return;
      let state = false;
      try {
        state = document.queryCommandState(cmd);
      } catch (e) {
        state = false;
      }
      if (state) btn.classList.add("active");
      else btn.classList.remove("active");
    });
  }

  // Cập nhật giá trị cho dropdown font và size
  function updateDropdownValues() {
    // Font name
    let fontName = "";
    try {
      fontName = document.queryCommandValue("fontName");
    } catch (e) { fontName = ""; }
    if (fontName) {
      // Một số browser trả về fontName có thêm dấu ngoặc hoặc in hoa/nhỏ khác
      fontFamilies.forEach(f => {
        if (fontName.toLowerCase().includes(f.split(",")[0].toLowerCase())) {
          fontSelect.value = f;
        }
      });
    }

    // Font size (giá trị 1–7)
    let fontSize = "";
    try {
      fontSize = document.queryCommandValue("fontSize");
    } catch (e) { fontSize = ""; }
    if (fontSize) {
      sizeSelect.value = fontSize;
    }
  }

  // Mở/đóng dropdown khi nhấn “More”
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    moreContent.classList.toggle("open");
  });
  document.addEventListener("click", () => {
    moreContent.classList.remove("open");
  });

  // Sự kiện khi soạn thảo: cập nhật hiddenInput, counter, activeStates, dropdownValues, kiểm overflow
  ["input", "keyup", "mouseup", "paste"].forEach(evt => {
    editor.addEventListener(evt, () => {
      updateHiddenInput();
      updateCounter();
      updateActiveStates();
      updateDropdownValues();
    });
  });

  // Bắt sự kiện selectionchange để cập nhật toolbar khi di chuyển con trỏ/chọn đoạn
  document.addEventListener("selectionchange", () => {
    if (document.activeElement === editor) {
      updateActiveStates();
      updateDropdownValues();
    }
  });

  // Phím tắt: Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z, Ctrl+Y
  editor.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          doCommand("bold");
          break;
        case "i":
          e.preventDefault();
          doCommand("italic");
          break;
        case "u":
          e.preventDefault();
          doCommand("underline");
          break;
        case "z":
          e.preventDefault();
          doCommand("undo");
          break;
        case "y":
          e.preventDefault();
          doCommand("redo");
          break;
      }
    }
  });

  // Khi submit form, copy nội dung lần cuối
  form.addEventListener("submit", () => {
    updateHiddenInput();
  });

  // Khởi tạo lần đầu
  updateHiddenInput();
  updateCounter();
  updateActiveStates();
  updateDropdownValues();
});
