
import { Routes, Route, NavLink, Link } from "react-router";
import DoctorsPage from "./pages/DoctorsPage";
import AuthPage from "./pages/AuthPage";
import AccountPage from "./pages/AccountPage";
import RequireAuth from "./auth/RequireAuth";
import LogoutButton from "./auth/LogoutButton";
import { useAuth } from "./auth/useAuth";

// Trang chủ
function Home() {
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-content">
          <p>CHĂM SÓC SỨC KHỎE THÔNG MINH</p>

          <h1>
            Đúng bác sĩ.
            <br />
            Đúng thời điểm.
          </h1>

          <p>
            Tìm bác sĩ phù hợp, chọn lịch khám linh hoạt
            và chủ động chăm sóc sức khỏe của bạn cùng SunCare.
          </p>

          <Link to="/booking">Đặt lịch ngay</Link>
          {" "}
          <Link to="/doctors">Tìm bác sĩ →</Link>
        </div>

        <div className="hero-card">
          <h2>Sức khỏe của bạn là ưu tiên của chúng tôi.</h2>
          <p>Đặt lịch nhanh chóng, an tâm trong từng lần khám.</p>
        </div>
      </section>
    </main>
  );
}

// Component trang tạm thời
function Page({ title }) {
  return (
    <main style={{ padding: "60px" }}>
      <h1>{title}</h1>
      <p>Chào mừng bạn đến với SunCare.</p>
    </main>
  );
}

function App() {
  const { user, status, retrySession, storageWarning } = useAuth();
  return (
    <>
      {/* Thanh menu */}
      <header className="header">
        <Link to="/" className="logo">
          SunCare
        </Link>

        <nav className="nav">
          <NavLink to="/" end>Trang chủ</NavLink>
          <NavLink to="/specialties">Chuyên khoa</NavLink>
          <NavLink to="/doctors">Bác sĩ</NavLink>
          <NavLink to="/about-us">Giới thiệu</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
          <NavLink to="/contact">Liên hệ</NavLink>
        </nav>

        <div className="header-actions">
          <Link to="/booking">Đặt lịch ngay</Link>
          {user ? <><Link to="/account" className="account-link" title={user.email}>{user.email}</Link><LogoutButton /></>
            : status === "checking" ? <span role="status">Đang kiểm tra phiên…</span>
              : <><Link to="/login">Đăng nhập</Link><Link to="/register">Đăng ký</Link>
                {status === "error" && <button className="button button-secondary" onClick={retrySession}>Kiểm tra lại phiên</button>}</>}
        </div>
      </header>
      {storageWarning && <p className="feedback feedback-error" role="status">{storageWarning}</p>}

      {/* Cấu hình các trang */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/specialties" element={<Page title="Chuyên khoa" />} />
        <Route path="/doctors" element={<DoctorsPage key={user?.id || "guest"} />} />
        <Route path="/about-us" element={<Page title="Giới thiệu" />} />
        <Route path="/faq" element={<Page title="Câu hỏi thường gặp" />} />
        <Route path="/contact" element={<Page title="Liên hệ" />} />
        <Route path="/booking" element={<RequireAuth><Page title="Đặt lịch khám" /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
        <Route path="*" element={<Page title="404 - Không tìm thấy trang" />} />
      </Routes>
    </>
  );
}

export default App;
