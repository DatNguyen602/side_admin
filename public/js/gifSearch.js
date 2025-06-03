// public/js/gifSearch.js
  // Lấy container và đọc data-attributes (là string)
  const gifContainer = document.getElementById("gif-container");
  if (gifContainer) {
    // parseInt offset, chuyển hasMore từ "true"/"false" thành boolean, query là string
    let offset = parseInt(gifContainer.dataset.offset, 10) || 0;
    let hasMore = gifContainer.dataset.hasmore === "true";
    const query = gifContainer.dataset.query || "";

    const loadingDiv = document.getElementById("loading");

    // Tạo card GIF mới
    function createGifCard(gif) {
      const card = document.createElement("div");
      card.className = "gif-card bg-white shadow-md rounded-lg overflow-hidden";

      const img = document.createElement("img");
      img.src = gif.proxyUrl;
      img.alt = gif.title || "Không có tiêu đề";
      img.className = "w-full h-48 object-cover";
      card.appendChild(img);

      const info = document.createElement("div");
      info.className = "p-3";

      const titleP = document.createElement("p");
      titleP.className = "text-sm text-gray-700 font-semibold truncate";
      titleP.textContent = gif.title || "Không có tiêu đề";
      info.appendChild(titleP);

      if (gif.isSaved) {
        const pStored = document.createElement("p");
        pStored.className = "w-full bg-blue-500 text-white px-3 py-2 rounded-lg text-center";
        pStored.textContent = "Stored";
        info.appendChild(pStored);
      } else {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/admin/gif/save";
        form.className = "mt-2";

        const inputJson = document.createElement("input");
        inputJson.type = "hidden";
        inputJson.name = "gifJson";
        inputJson.value = JSON.stringify(gif);
        form.appendChild(inputJson);

        const inputQ = document.createElement("input");
        inputQ.type = "hidden";
        inputQ.name = "q";
        inputQ.value = query;
        form.appendChild(inputQ);

        const btnSave = document.createElement("button");
        btnSave.className = "w-full bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition";
        btnSave.textContent = "Save";
        form.appendChild(btnSave);

        info.appendChild(form);
      }

      card.appendChild(info);
      return card;
    }

    // Hàm load thêm GIF khi scroll gần đáy
    async function loadMore() {
      // if (!hasMore) return;
      loadingDiv.style.display = "block";

      try {
        const res = await fetch(
          `/admin/gif/search/json?q=${encodeURIComponent(query)}&offset=${offset}`,
          { headers: { Accept: "application/json" } }
        );
        if (!res.ok) throw new Error("Không thể tải thêm GIF");

        const data = await res.json();
        data.gifs.forEach(gif => {
          const card = createGifCard(gif);
          gifContainer.appendChild(card);
        });

        // Cập nhật offset và hasMore
        offset = data.nextOffset;
        hasMore = data.hasMore;
      } catch (err) {
        console.error(err);
      } finally {
        loadingDiv.style.display = "none";
      }
    }

      // Lấy chính element content-wrapper
      const contentWrapper = document.querySelector(".content-wrapper");
      if (!contentWrapper) {
          console.error("Không tìm thấy .content-wrapper");
      } else {
          contentWrapper.addEventListener("scroll", () => {
              if (!hasMore) return;
              if ((contentWrapper.scrollTop + contentWrapper.clientHeight) >= (contentWrapper.scrollHeight - 50)) {
                hasMore = false; // tạm khóa tránh gọi lặp
                loadMore();
              }
          });
      }
  }