from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.contrib.auth import password_validation 
from django.core.exceptions import ValidationError
class UserLoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.error_messages['invalid_login'] = "Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại (Lưu ý chữ hoa/thường)."
        self.error_messages['inactive'] = "Tài khoản này hiện đang bị khóa."

    username = forms.CharField(
        label="Tên tài khoản",
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nhập tên tài khoản',
        }),
        error_messages={'required': 'Vui lòng nhập tên tài khoản.'}
    )
    password = forms.CharField(
        label="Mật khẩu",
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nhập mật khẩu',
        }),
        error_messages={'required': 'Vui lòng nhập mật khẩu.'}
    )

class UserRegisterForm(forms.ModelForm):
    # Định nghĩa thủ công các trường để Django không tự ý chèn validator tiếng Anh
    username = forms.CharField(
        label="Tên tài khoản",
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nhập tên tài khoản'}),
        error_messages={'required': 'Vui lòng nhập tên tài khoản.'}
    )
    
    password1 = forms.CharField(
        label="Mật khẩu",
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Nhập mật khẩu'}),
        error_messages={'required': 'Vui lòng nhập mật khẩu.'}
    )
    
    password2 = forms.CharField(
        label="Xác nhận mật khẩu",
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Nhập lại mật khẩu'}),
        error_messages={'required': 'Vui lòng xác nhận mật khẩu.'}
    )

    class Meta:
        model = User
        fields = ("username",)

    def clean_username(self):
        username = self.cleaned_data.get('username')
        if User.objects.filter(username=username).exists():
            raise ValidationError("Tên tài khoản này đã tồn tại.")
        return username

    def clean(self):
        cleaned_data = super().clean()
        p1 = cleaned_data.get("password1")
        p2 = cleaned_data.get("password2")
        username = cleaned_data.get("username")

        # 1. Kiểm tra khớp mật khẩu
        if p1 and p2 and p1 != p2:
            self.add_error('password2', "Mật khẩu xác nhận không khớp.")

        # 2. Chạy kiểm tra bảo mật cho p1 và tự dịch lỗi
        if p1:
            try:
                # Tạo một user ảo để validate (tránh lỗi phụ thuộc thông tin user)
                user = User(username=username)
                password_validation.validate_password(p1, user)
            except ValidationError as e:
                custom_errors = []
                for error in e.messages:
                    err_lower = error.lower()
                    if "too short" in err_lower:
                        custom_errors.append("Mật khẩu quá ngắn. Phải chứa ít nhất 8 ký tự.")
                    elif "too common" in err_lower:
                        custom_errors.append("Mật khẩu này quá phổ biến.")
                    elif "entirely numeric" in err_lower:
                        custom_errors.append("Mật khẩu không được chỉ chứa toàn chữ số.")
                    elif "too similar" in err_lower:
                        custom_errors.append("Mật khẩu quá giống tên tài khoản.")
                    else:
                        custom_errors.append(error)
                # Chỉ đẩy lỗi vào ô mật khẩu chính (password1)
                self.add_error('password1', ValidationError(custom_errors))

        return cleaned_data

    def save(self, commit=True):
        # Vì không dùng UserCreationForm nên ta phải tự xử lý băm mật khẩu (hashing)
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user