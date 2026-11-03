import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import { getRequestError } from "../api/client";

function destination(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value : "/account";
}

export default function AuthPage({ mode }) {
  const registering = mode === "register";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status, register, login } = useAuth();
  const [email, setEmail] = useState(() => location.state?.email || "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const from = destination(location.state?.from);

  if (user) return <Navigate to={from} replace />;
  if (status === "checking") return <main className="auth-state" role="status">Đang kiểm tra phiên đăng nhập…</main>;

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) nextErrors.email = "Vui lòng nhập email.";
    else if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      nextErrors.email = "Vui lòng nhập email hợp lệ, tối đa 254 ký tự.";
    if (password.length < 8 || password.length > 128 || !/\S/.test(password))
      nextErrors.password = "Mật khẩu phải có từ 8 đến 128 ký tự và không chỉ gồm khoảng trắng.";
    if (registering && confirmation !== password) nextErrors.confirmation = "Mật khẩu nhập lại không khớp.";
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      if (registering) {
        await register({ email: cleanEmail, password });
        navigate("/login", { replace: true, state: { registered: true, email: cleanEmail, from } });
      } else {
        await login({ email: cleanEmail, password });
        navigate(from, { replace: true });
      }
    } catch (requestError) {
      setError(getRequestError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-intro">
      <p className="eyebrow">ĐỒNG HÀNH CÙNG SUNCARE</p>
      <h1>{registering ? "Bắt đầu hành trình\nchăm sóc sức khỏe." : "Chào mừng bạn\ntrở lại SunCare."}</h1>
      <p>Một tài khoản để kết nối với đội ngũ bác sĩ và chủ động chăm sóc sức khỏe của bạn.</p>
      <div className="auth-intro-note"><span aria-hidden="true">✦</span><p>Thông tin luôn sẵn sàng cho lần truy cập tiếp theo.</p></div>
      <Link to="/doctors">Khám phá đội ngũ bác sĩ →</Link>
    </section>
    <section className="panel auth-panel" aria-labelledby="auth-title">
      <p className="eyebrow">TÀI KHOẢN SUNCARE</p>
      <h2 id="auth-title">{registering ? "Tạo tài khoản" : "Đăng nhập"}</h2>
      <p className="auth-description">{registering ? "Nhập email và mật khẩu để đăng ký." : "Sử dụng tài khoản bạn đã đăng ký để tiếp tục."}</p>
      {!registering && location.state?.registered && <p className="feedback feedback-success" role="status">Đăng ký thành công! Bạn có thể đăng nhập ngay.</p>}
      {location.state?.from && <p className="auth-hint">Đăng nhập để tiếp tục đến trang bạn đã chọn.</p>}
      <form onSubmit={submit} noValidate className="auth-form" aria-busy={submitting}>
        <div className="form-field">
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="ban@example.com" required maxLength={254}
            value={email} disabled={submitting} onChange={(event) => { setEmail(event.target.value); setErrors({ ...errors, email: "" }); }}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
          {errors.email && <p id="email-error" className="field-error" role="alert">{errors.email}</p>}
        </div>
        <div className="form-field">
          <label htmlFor="auth-password">Mật khẩu</label>
          <input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"}
            placeholder="Từ 8 đến 128 ký tự" required minLength={8} maxLength={128} value={password} disabled={submitting}
            onChange={(event) => { setPassword(event.target.value); setErrors({ ...errors, password: "" }); }}
            aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : "password-hint"} />
          <p id="password-hint" className="form-hint">Từ 8 đến 128 ký tự. Phân biệt chữ hoa, chữ thường.</p>
          {errors.password && <p id="password-error" className="field-error" role="alert">{errors.password}</p>}
        </div>
        {registering && <div className="form-field">
          <label htmlFor="auth-confirmation">Nhập lại mật khẩu</label>
          <input id="auth-confirmation" name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password"
            required maxLength={128} value={confirmation} disabled={submitting}
            onChange={(event) => { setConfirmation(event.target.value); setErrors({ ...errors, confirmation: "" }); }}
            aria-invalid={!!errors.confirmation} aria-describedby={errors.confirmation ? "confirmation-error" : undefined} />
          {errors.confirmation && <p id="confirmation-error" className="field-error" role="alert">{errors.confirmation}</p>}
        </div>}
        <label className="show-password"><input type="checkbox" checked={showPassword} disabled={submitting} onChange={(event) => setShowPassword(event.target.checked)} /> Hiện mật khẩu</label>
        {error && <p className="feedback feedback-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={submitting}>{submitting ? "Đang xử lý…" : registering ? "Đăng ký" : "Đăng nhập"}</button>
      </form>
      <p className="auth-switch">{registering ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <Link to={registering ? "/login" : "/register"} state={{ from }}>{registering ? "Đăng nhập" : "Đăng ký ngay"}</Link></p>
    </section>
  </main>;
}
