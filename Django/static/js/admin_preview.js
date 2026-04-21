document.addEventListener('DOMContentLoaded', function() {
    const imgInput = document.querySelector('#id_img');
    if (imgInput) {
        // Tạo div để hiển thị preview
        const previewDiv = document.createElement('div');
        previewDiv.id = 'img-preview';
        previewDiv.style.marginTop = '10px';
        imgInput.parentNode.appendChild(previewDiv);

        // Hàm cập nhật preview
        function updatePreview() {
            const url = imgInput.value;
            if (url) {
                previewDiv.innerHTML = `<img src="${url}" style="max-width: 200px; max-height: 200px; border: 1px solid #ccc;" />`;
            } else {
                previewDiv.innerHTML = '';
            }
        }

        // Cập nhật preview khi nhập
        imgInput.addEventListener('input', updatePreview);
        // Cập nhật preview ban đầu
        updatePreview();
    }
});