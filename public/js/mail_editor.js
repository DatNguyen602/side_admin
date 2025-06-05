// public/js/mail_editor.js

/**
 * MailEditor: A modular, extensible WYSIWYG email editor.
 *
 * Features:
 *  - Dynamic toolbar creation (commands, font family, font size, color pickers)
 *  - Code View toggle (switch between WYSIWYG and raw HTML)
 *  - Auto-save to localStorage (debounced)
 *  - Drag-and-drop image insertion
 *  - Preview in a new window
 *  - Word/character count (debounced)
 *  - Plugin API (register plugins that can hook into commands or content changes)
 *  - Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z, Ctrl+Y)
 *
 * Usage:
 *   const editor = new MailEditor({
 *     editorSelector: '#editor',
 *     toolbarSelector: '#toolbar',
 *     hiddenInputSelector: '#emailContent',
 *     formSelector: '#emailForm',
 *     previewButtonSelector: '#previewEmail',
 *     autoSaveKey: 'myEmailDraft',
 *     autoSaveInterval: 5000 // in ms
 *   });
 *   editor.init();
 */

class MailEditor {
    /**
     * @param {Object} options
     * @param {string} options.editorSelector     CSS selector for the editable container.
     * @param {string} options.toolbarSelector    CSS selector for the toolbar container.
     * @param {string} options.hiddenInputSelector CSS selector for the hidden input to sync HTML.
     * @param {string} options.formSelector       CSS selector for the form element.
     * @param {string} options.previewButtonSelector CSS selector for the “Preview” button.
     * @param {string} [options.autoSaveKey]      localStorage key for auto-saving.
     * @param {number} [options.autoSaveInterval] Auto-save interval in milliseconds.
     */
    constructor({
        editorSelector,
        toolbarSelector,
        hiddenInputSelector,
        formSelector,
        previewButtonSelector,
        autoSaveKey = null,
        autoSaveInterval = 5000,
    }) {
        // DOM elements
        this.editor = document.querySelector(editorSelector);
        this.toolbar = document.querySelector(toolbarSelector);
        this.hiddenInput = document.querySelector(hiddenInputSelector);
        this.form = document.querySelector(formSelector);
        this.previewButton = document.querySelector(previewButtonSelector);

        // Auto-save settings
        this.autoSaveKey = autoSaveKey;
        this.autoSaveInterval = autoSaveInterval;
        this.autoSaveTimerId = null;

        // Plugin container
        this.plugins = [];

        // Debounce timers
        this._debounceTimer = null;
        this._debounceDelay = 300;

        // COUNTER ELEMENTS (assumes these exist)
        this.charCountEl = document.getElementById("char-count");
        this.wordCountEl = document.getElementById("word-count");

        // STATE
        this.isCodeView = false;

        // CONFIG: Basic commands
        this.commands = [
            { cmd: "undo", label: "↺", title: "Undo (Ctrl+Z)" },
            { cmd: "redo", label: "↻", title: "Redo (Ctrl+Y)" },
            { cmd: "bold", label: "<b>B</b>", title: "In đậm (Ctrl+B)" },
            { cmd: "italic", label: "<i>I</i>", title: "In nghiêng (Ctrl+I)" },
            {
                cmd: "underline",
                label: "<u>U</u>",
                title: "Gạch chân (Ctrl+U)",
            },
            { cmd: "strikeThrough", label: "<s>S</s>", title: "Gạch ngang" },
            { cmd: "justifyLeft", label: "🡸", title: "Căn trái" },
            { cmd: "justifyCenter", label: "☉", title: "Căn giữa" },
            { cmd: "justifyRight", label: "🡺", title: "Căn phải" },
            { cmd: "justifyFull", label: "⤫", title: "Căn đều hai bên" },
            {
                cmd: "insertOrderedList",
                label: "1.",
                title: "Danh sách đánh số",
            },
            {
                cmd: "insertUnorderedList",
                label: "•",
                title: "Danh sách gạch đầu dòng",
            },
            { cmd: "indent", label: "⮕", title: "Thụt đầu dòng" },
            { cmd: "outdent", label: "⮔", title: "Giãn đoạn" },
            { cmd: "removeFormat", label: "✖", title: "Xóa định dạng" },
            { cmd: "insertBlockquote", label: "❝❞", title: "Chèn Blockquote" },
            // Headings (formatBlock). value needs to be surrounded by tags: e.g. <h1>
            {
                cmd: "formatBlock",
                label: "H1",
                title: "Heading 1",
                value: "<h1>",
            },
            {
                cmd: "formatBlock",
                label: "H2",
                title: "Heading 2",
                value: "<h2>",
            },
            {
                cmd: "formatBlock",
                label: "H3",
                title: "Heading 3",
                value: "<h3>",
            },
            {
                cmd: "insertImage",
                label: "🖼",
                title: "Chèn ảnh",
                promptText: "Nhập URL ảnh:",
            },
            {
                cmd: "createLink",
                label: "🔗",
                title: "Chèn link",
                promptText: "Nhập URL liên kết:",
            },
            {
                cmd: "insertHTML",
                label: "{ }",
                title: "Chèn Code Block",
                value: "<pre><code>Nhập code ...</code></pre>",
            },
            {
                cmd: "toggleCodeView",
                label: "</>",
                title: "Chế độ Code View",
            },
        ];

        // CONFIG: Color pickers
        this.colorPickers = [
            { cmd: "foreColor", label: "A", title: "Màu chữ" },
            { cmd: "hiliteColor", label: "🖍", title: "Màu nền" },
        ];

        // CONFIG: Font families
        this.fontFamilies = [
            "Arial, sans-serif",
            "Helvetica, sans-serif",
            "Segoe UI, sans-serif",
            "Tahoma, sans-serif",
            "Verdana, sans-serif",
            "Roboto, sans-serif",
            "Open Sans, sans-serif",
            "Lato, sans-serif",
            "Poppins, sans-serif",
            "Noto Sans, sans-serif",
            "Georgia, serif",
            "Times New Roman, serif",
            "Palatino Linotype, serif",
            "Garamond, serif",
            "Courier New, monospace",
            "Lucida Console, monospace",
            "Fira Code, monospace",
            "Source Code Pro, monospace",
            "Comic Sans MS, cursive",
            "Brush Script MT, cursive",
            "System-ui, sans-serif",
        ];

        // CONFIG: Font sizes (1–7 map to browser execCommand values)
        this.fontSizes = [
            { label: "8px", value: "1" },
            { label: "10px", value: "2" },
            { label: "12px", value: "3" },
            { label: "14px", value: "4" },
            { label: "18px", value: "5" },
            { label: "24px", value: "6" },
            { label: "32px", value: "7" },
        ];
    }

    /**
     * Initialize the editor: build toolbar, bind events, and restore auto‐saved content.
     */
    init() {
        if (!this.editor || !this.toolbar || !this.hiddenInput || !this.form) {
            console.error(
                "MailEditor: One or more required elements not found."
            );
            return;
        }

        this._buildFontDropdown();
        this._buildSizeDropdown();
        this._buildToolbarButtons();
        this._buildColorPickers();
        this._bindEditorEvents();
        this._bindFormEvents();
        this._bindPreviewEvent();
        this._bindDragAndDrop();
        this._restoreAutoSavedContent();
        this._updateHiddenInput();
        this._updateCounter();
        this._updateActiveStates();
        this._updateDropdownValues();
    }

    /**
     * Register a plugin. Each plugin is an object with optional hooks:
     *   - onContentChange(htmlString)
     *   - onCommandExecute(cmdName, value)
     *   - onInitialized(editorInstance)
     * Plugins can extend functionality (e.g., AI suggestions, emoji pickers, etc.).
     *
     * @param {Object} plugin
     */
    registerPlugin(plugin) {
        if (typeof plugin !== "object") return;
        this.plugins.push(plugin);
        // If plugin has init hook, call it now
        if (typeof plugin.onInitialized === "function") {
            plugin.onInitialized(this);
        }
    }

    /**
     * Build the Font Family <select> dropdown.
     * Places it at the beginning of the toolbar.
     */
    _buildFontDropdown() {
        const fontSelect = document.createElement("select");
        fontSelect.classList.add("toolbar-select");
        fontSelect.title = "Chọn Font";
        fontSelect.setAttribute("aria-label", "Chọn Font");

        this.fontFamilies.forEach((f) => {
            const opt = document.createElement("option");
            opt.value = f;
            opt.innerText = f.split(",")[0];
            fontSelect.appendChild(opt);
        });

        fontSelect.addEventListener("change", () => {
            this._execCommand("fontName", fontSelect.value);
        });

        this.toolbar.appendChild(fontSelect);
        this.fontSelect = fontSelect; // Keep reference for later updates
    }

    /**
     * Build the Font Size <select> dropdown.
     * Places it next after the font dropdown.
     */
    _buildSizeDropdown() {
        const sizeSelect = document.createElement("select");
        sizeSelect.classList.add("toolbar-select");
        sizeSelect.title = "Chọn kích thước chữ";
        sizeSelect.setAttribute("aria-label", "Chọn kích thước chữ");

        this.fontSizes.forEach((fs) => {
            const opt = document.createElement("option");
            opt.value = fs.value;
            opt.innerText = fs.label;
            sizeSelect.appendChild(opt);
        });

        sizeSelect.addEventListener("change", () => {
            this._execCommand("fontSize", sizeSelect.value);
        });

        this.toolbar.appendChild(sizeSelect);
        this.sizeSelect = sizeSelect;
    }

    /**
     * Build all toolbar buttons (including “More” dropdown if space is limited).
     */
    _buildToolbarButtons() {
        // Create “More” dropdown container
        this.moreDropdown = document.createElement("div");
        this.moreDropdown.id = "more-dropdown";
        this.moreDropdown.style.display = "inline-block";
        this.moreDropdown.style.position = "relative";

        const moreBtn = document.createElement("button");
        moreBtn.id = "more-dropdown-btn";
        moreBtn.type = "button";
        moreBtn.innerHTML = "⋯";
        moreBtn.title = "Thêm";
        moreBtn.setAttribute("aria-haspopup", "true");
        moreBtn.setAttribute("aria-expanded", "false");

        this.moreDropdown.appendChild(moreBtn);

        const moreContent = document.createElement("div");
        moreContent.id = "more-dropdown-content";
        moreContent.classList.add("hidden"); // initially hidden via CSS
        this.moreDropdown.appendChild(moreContent);

        // Insert “More” placeholder at the end:
        this.toolbar.appendChild(this.moreDropdown);
        this.moreContent = moreContent;
        this.moreBtn = moreBtn;

        // Event to toggle “More” dropdown
        moreBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = !moreContent.classList.contains("open");
            moreContent.classList.toggle("open", isOpen);
            moreBtn.setAttribute("aria-expanded", isOpen);
        });
        document.addEventListener("click", () => {
            moreContent.classList.remove("open");
            moreBtn.setAttribute("aria-expanded", "false");
        });

        // Create each command button
        this.commands.forEach((item) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.classList.add("toolbar-btn");
            btn.innerHTML = item.label;
            btn.title = item.title;
            btn.setAttribute("aria-label", item.title);
            btn.dataset.cmd = item.cmd;
            if (item.value) btn.dataset.value = item.value;
            if (item.promptText) btn.dataset.prompt = item.promptText;

            // Click handler
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const command = btn.dataset.cmd;
                if (command === "toggleCodeView") {
                    this._toggleCodeView();
                    return;
                }

                if (btn.dataset.prompt) {
                    const url = window.prompt(btn.dataset.prompt);
                    if (url) this._execCommand(item.cmd, url);
                } else if (btn.dataset.value) {
                    this._execCommand(item.cmd, item.value);
                } else {
                    this._execCommand(item.cmd);
                }
            });

            // Insert either directly or into “More” container based on width analysis later.
            // For simplicity, we insert all into toolbar; you can implement resizing logic if needed.
            this.toolbar.insertBefore(btn, this.moreDropdown);
        });
    }

    /**
     * Build color picker buttons (foreground and background).
     */
    _buildColorPickers() {
        this.colorPickers.forEach((item) => {
            const wrapper = document.createElement("span");
            wrapper.style.display = "inline-flex";
            wrapper.style.alignItems = "center";
            wrapper.title = item.title;
            wrapper.setAttribute("aria-label", item.title);

            const iconBtn = document.createElement("button");
            iconBtn.type = "button";
            iconBtn.classList.add("toolbar-btn");
            iconBtn.innerHTML = item.label;
            iconBtn.title = item.title;
            iconBtn.dataset.cmd = item.cmd;

            // Hidden native <input type="color">
            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = "#000000";
            colorInput.style.width = "0";
            colorInput.style.height = "0";
            colorInput.style.opacity = "0";
            colorInput.style.position = "absolute";
            colorInput.setAttribute("aria-hidden", "true");

            iconBtn.addEventListener("click", (e) => {
                e.preventDefault();
                colorInput.click();
            });
            colorInput.addEventListener("input", (e) => {
                this._execCommand(item.cmd, e.target.value);
            });

            wrapper.appendChild(iconBtn);
            wrapper.appendChild(colorInput);
            this.toolbar.insertBefore(wrapper, this.moreDropdown);
        });
    }

    /**
     * Core function to execute document.execCommand and notify plugins.
     * @param {string} cmdName
     * @param {string|null} [value]
     */
    _execCommand(cmdName, value = null) {
        if (this.isCodeView && cmdName !== "toggleCodeView") {
            // In code view, do not execute formatting commands
            return;
        }

        try {
            if (value) {
                document.execCommand(cmdName, false, value);
            } else {
                document.execCommand(cmdName, false, null);
            }
        } catch (err) {
            console.warn(`Lệnh ${cmdName} không được hỗ trợ:`, err);
        }

        // Refocus to editor
        this.editor.focus();

        // Sync content, update states, counter, dropdowns
        this._updateHiddenInput();
        this._updateActiveStates();
        this._updateDropdownValues();
        this._debouncedUpdateCounter();

        // Notify plugins
        this.plugins.forEach((pl) => {
            if (typeof pl.onCommandExecute === "function") {
                pl.onCommandExecute(cmdName, value);
            }
        });
    }

    /**
     * Update the hidden <input> with current editor HTML.
     */
    _updateHiddenInput() {
        if (this.isCodeView) {
            // When in code view, hiddenInput is synced from the textarea
            return;
        }
        this.hiddenInput.value = this.editor.innerHTML;
        // Plugins: onContentChange
        this.plugins.forEach((pl) => {
            if (typeof pl.onContentChange === "function") {
                pl.onContentChange(this.editor.innerHTML);
            }
        });
    }

    /**
     * Debounced word/character counter update.
     */
    _debouncedUpdateCounter() {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._updateCounter();
        }, this._debounceDelay);
    }

    /**
     * Calculate and display word & character counts.
     */
    _updateCounter() {
        const text = this.editor.innerText.trim();
        const chars = this.editor.innerText.length;
        const words = text === "" ? 0 : text.split(/\s+/).length;
        if (this.charCountEl) this.charCountEl.innerText = `Ký tự: ${chars}`;
        if (this.wordCountEl) this.wordCountEl.innerText = `Từ: ${words}`;
    }

    /**
     * Update active (pressed) states for toolbar buttons based on selection.
     */
    _updateActiveStates() {
        const btns = this.toolbar.querySelectorAll(".toolbar-btn");
        btns.forEach((btn) => {
            const cmd = btn.dataset.cmd;
            if (!cmd) return;

            let state = false;
            try {
                state = document.queryCommandState(cmd);
            } catch (e) {
                state = false;
            }
            btn.classList.toggle("active", state);
        });
    }

    /**
     * Update the font-family and font-size dropdown values to reflect current selection.
     */
    _updateDropdownValues() {
        // FONT NAME
        let currentFont = "";
        try {
            currentFont = document.queryCommandValue("fontName");
        } catch (e) {
            currentFont = "";
        }
        if (currentFont && this.fontSelect) {
            this.fontFamilies.forEach((f) => {
                if (
                    currentFont
                        .toLowerCase()
                        .includes(f.split(",")[0].toLowerCase())
                ) {
                    this.fontSelect.value = f;
                }
            });
        }

        // FONT SIZE
        let currentSize = "";
        try {
            currentSize = document.queryCommandValue("fontSize");
        } catch (e) {
            currentSize = "";
        }
        if (currentSize && this.sizeSelect) {
            this.sizeSelect.value = currentSize;
        }
    }

    /**
     * Toggle between WYSIWYG view and raw HTML code view.
     */
    _toggleCodeView() {
        if (this.isCodeView) {
            // Switch back to WYSIWYG
            const codeArea = this.editor; // currently a <textarea>
            const rawHtml = codeArea.value;
            // Create a new contenteditable div
            const newDiv = document.createElement("div");
            newDiv.id = "editor";
            newDiv.className = "editor";
            newDiv.contentEditable = "true";
            newDiv.innerHTML = rawHtml;
            // Replace in DOM
            codeArea.replaceWith(newDiv);
            this.editor = newDiv;
            this.isCodeView = false;
            // Re-bind events on new editor
            this._bindEditorEvents();
            // Update hidden input & states
            this._updateHiddenInput();
            this._updateCounter();
            this._updateActiveStates();
            this._updateDropdownValues();
        } else {
            // Switch to code view
            const currentHtml = this.editor.innerHTML;
            const codeArea = document.createElement("textarea");
            codeArea.id = "editor";
            codeArea.className = "editor-codeview";
            codeArea.value = currentHtml;
            // Replace in DOM
            this.editor.replaceWith(codeArea);
            this.editor = codeArea;
            this.isCodeView = true;
            // Only count characters and words in code view as raw text
            this._updateHiddenInput();
            this._updateCounter();
        }
    }

    /**
     * Bind core editor events: input, keyup, mouseup, paste, selectionchange, keydown for shortcuts.
     */
    _bindEditorEvents() {
        if (!this.editor) return;

        // Debounced content change handlers
        ["input", "keyup", "mouseup", "paste"].forEach((evt) => {
            this.editor.addEventListener(evt, () => {
                if (!this.isCodeView) {
                    this._updateHiddenInput();
                    this._debouncedUpdateCounter();
                    this._updateActiveStates();
                    this._updateDropdownValues();
                } else {
                    // In code view, only update hidden input & counter
                    this.hiddenInput.value = this.editor.value;
                    this._debouncedUpdateCounter();
                }
            });
        });

        // Selection change (when moving cursor or selecting text)
        document.addEventListener("selectionchange", () => {
            if (!this.isCodeView && document.activeElement === this.editor) {
                this._updateActiveStates();
                this._updateDropdownValues();
            }
        });

        // Keyboard shortcuts
        this.editor.addEventListener("keydown", (e) => {
            if (!this.isCodeView && (e.ctrlKey || e.metaKey)) {
                switch (e.key.toLowerCase()) {
                    case "b":
                        e.preventDefault();
                        this._execCommand("bold");
                        break;
                    case "i":
                        e.preventDefault();
                        this._execCommand("italic");
                        break;
                    case "u":
                        e.preventDefault();
                        this._execCommand("underline");
                        break;
                    case "z":
                        e.preventDefault();
                        this._execCommand("undo");
                        break;
                    case "y":
                        e.preventDefault();
                        this._execCommand("redo");
                        break;
                    default:
                        break;
                }
            }
        });
    }

    /**
     * Bind form submit to ensure final HTML is synced.
     */
    _bindFormEvents() {
        if (!this.form) return;
        this.form.addEventListener("submit", () => {
            // If in code view, copy from textarea
            if (this.isCodeView) {
                this.hiddenInput.value = this.editor.value;
            } else {
                this._updateHiddenInput();
            }
            // Clear auto-save once submitted
            if (this.autoSaveKey) {
                localStorage.removeItem(this.autoSaveKey);
            }
        });
    }

    /**
     * Bind “Preview” button to open a new window with the current HTML.
     */
    _bindPreviewEvent() {
        if (!this.previewButton) return;
        this.previewButton.addEventListener("click", () => {
            const htmlContent = this.isCodeView
                ? this.editor.value
                : this.editor.innerHTML;
            const win = window.open("", "_blank", "width=800,height=600");
            win.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>Preview Email</title></head>
          <body>${htmlContent}</body>
        </html>
      `);
            win.document.close();
        });
    }

    /**
     * Bind drag-and-drop on the editor to allow image files to be dropped.
     */
    _bindDragAndDrop() {
        if (!this.editor) return;
        // Prevent default behaviors
        ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => {
            this.editor.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Highlight editor when file is dragged over
        this.editor.addEventListener("dragover", () => {
            this.editor.classList.add("dragover");
        });
        this.editor.addEventListener("dragleave", () => {
            this.editor.classList.remove("dragover");
        });

        // Handle dropped files
        this.editor.addEventListener("drop", (e) => {
            this.editor.classList.remove("dragover");
            const files = Array.from(e.dataTransfer.files);
            files.forEach((file) => {
                if (file.type.startsWith("image/")) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const img = document.createElement("img");
                        img.src = evt.target.result;
                        img.alt = file.name;
                        // Insert at caret position
                        this._insertNodeAtCaret(img);
                        this._updateHiddenInput();
                    };
                    reader.readAsDataURL(file);
                }
                // Other file types can be handled here (e.g., attachments)
            });
        });
    }

    /**
     * Insert a DOM node at the current caret position inside the editor.
     * @param {Node} node
     */
    _insertNodeAtCaret(node) {
        let sel, range;
        if (window.getSelection) {
            sel = window.getSelection();
            if (sel.getRangeAt && sel.rangeCount) {
                range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(node);
                // Move caret after inserted node
                range.setStartAfter(node);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }

    /**
     * Save current content to localStorage (if configured).
     */
    _autoSaveContent() {
        if (!this.autoSaveKey) return;
        const html = this.isCodeView
            ? this.editor.value
            : this.editor.innerHTML;
        try {
            localStorage.setItem(this.autoSaveKey, html);
        } catch (e) {
            console.warn("Auto-save failed:", e);
        }
    }

    /**
     * Restore content from localStorage (if available).
     */
    _restoreAutoSavedContent() {
        if (!this.autoSaveKey) return;
        const saved = localStorage.getItem(this.autoSaveKey);
        if (saved) {
            this.editor.innerHTML = saved;
        }
        // Start auto-save timer (debounced)
        this.autoSaveTimerId = setInterval(() => {
            this._autoSaveContent();
        }, this.autoSaveInterval);
    }
}

// Initialize once DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    const mailEditor = new MailEditor({
        editorSelector: "#editor",
        toolbarSelector: "#toolbar",
        hiddenInputSelector: "#emailContent",
        formSelector: "#emailForm",
        previewButtonSelector: "#previewEmail",
        autoSaveKey: "myEmailDraft", // Change key as needed
        autoSaveInterval: 5000, // Every 5 seconds
    });

    // Example of registering a dummy plugin (e.g., emoji picker) in the future:
    // mailEditor.registerPlugin({
    //   onInitialized(editor) { /* … */ },
    //   onCommandExecute(cmd, value) { /* … */ },
    //   onContentChange(html) { /* … */ }
    // });

    mailEditor.init();
});
