function updateTime() {
    // Biến toàn cục để lưu thông tin địa lý (được cập nhật khi có dữ liệu từ reverse geocoding)
    let locationInfo = "";

    // Hàm cập nhật đồng hồ và hiển thị cùng thông tin vị trí
    function updateClock() {
      const now = new Date();
      const days = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
      const dayOfWeek = days[now.getDay()];

      // Lấy ngày, tháng, năm, giờ, phút, giây (định dạng 2 chữ số)
      const day   = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year  = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');

      const dateFormatted = `${day}/${month}/${year}`;
      const timeFormatted = `${hours}:${minutes}:${seconds}`;

      // Nối chuỗi hiển thị: thời gian và thông tin vị trí
      const outputString = `${dayOfWeek} | Ngày: ${dateFormatted} | ${timeFormatted}`;

      document.getElementById('clock').innerText = outputString;
    }

    // Cập nhật đồng hồ mỗi giây
    setInterval(updateClock, 1000);
    updateClock(); // Gọi ngay khi trang tải

    // Cấu hình cho Geolocation
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    // Hàm thành công khi lấy được vị trí của người dùng
    function geoSuccess(position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
    }

    // Hàm xử lý lỗi khi không lấy được vị trí
    function geoError(err) {
      locationInfo = `Lỗi khi lấy vị trí: ${err.message}`;
    }

    // Kiểm tra hỗ trợ Geolocation và thực hiện lấy vị trí
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(geoSuccess, geoError, options);
    } else {
      locationInfo = "Trình duyệt của bạn không hỗ trợ Geolocation.";
    }
}

// Cập nhật thời gian ngay khi trang load
updateTime();
// Cập nhật lại mỗi 1 giây (1000ms)
setInterval(updateTime, 1000);
