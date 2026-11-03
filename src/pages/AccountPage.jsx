import { Link } from "react-router";
import { useAuth } from "../auth/useAuth";
import LogoutButton from "../auth/LogoutButton";

export default function AccountPage() {
  const { user, expiresAt } = useAuth();
  return <main className="account-page">
    <p className="eyebrow">TÀI KHOẢN CỦA BẠN</p>
    <h1>Xin chào, {user.email.split("@")[0]}.</h1>
    <p>Bạn đã đăng nhập thành công vào SunCare.</p>
    <section className="panel account-panel" aria-labelledby="account-title">
      <h2 id="account-title">Thông tin tài khoản</h2>
      <dl><div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Mã tài khoản</dt><dd>#{user.id}</dd></div>
        <div><dt>Ngày đăng ký</dt><dd>{new Date(user.createdAt).toLocaleString("vi-VN")}</dd></div>
        <div><dt>Phiên đăng nhập có hiệu lực đến</dt><dd>{new Date(expiresAt).toLocaleString("vi-VN")}</dd></div></dl>
      <div className="account-actions"><Link className="button button-primary" to="/doctors">Xem và quản lý bác sĩ</Link><LogoutButton /></div>
    </section>
  </main>;
}
