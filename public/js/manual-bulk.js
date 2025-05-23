document.addEventListener('DOMContentLoaded', () => {
  let rowIndex = 1;

  const addRowBtn = document.getElementById('addRowBtn');
  const userTable = document.querySelector('#userTable tbody');

  try {
    userTable.rows[0].querySelector('.deleteRowBtn').style.display = 'none';
  }
  catch (ex) {
    console.log(ex);
  }

  if (!addRowBtn || !userTable) return; // an toàn

  addRowBtn.addEventListener('click', () => {
    const newRow = userTable.rows[0].cloneNode(true);

    [...newRow.querySelectorAll('input, select')].forEach(el => {
      el.name = el.name.replace(/\[\d+\]/, `[${rowIndex}]`);
      el.value = '';
    });

    const deleteBtn = newRow.querySelector('.deleteRowBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'block';
      deleteBtn.addEventListener('click', () => {
        if (userTable.rows.length > 1) {
          deleteBtn.closest('tr').remove();
        }
      });
    }

    userTable.appendChild(newRow);
    rowIndex++;
  });

  // Gán sự kiện xoá cho dòng đầu tiên
  const initialDeleteBtn = userTable.querySelector('.deleteRowBtn');
  if (initialDeleteBtn) {
    initialDeleteBtn.addEventListener('click', () => {
      if (userTable.rows.length > 1) {
        initialDeleteBtn.closest('tr').remove();
      }
    });
  }
});
