import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDoctor,
  deleteDoctor,
  getApiError,
  getDoctor,
  getDoctors,
  updateDoctor,
} from "../api/doctorApi";

const emptyForm = { name: "", specialty: "" };

function validate(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Vui lòng nhập họ tên bác sĩ.";
  else if (values.name.trim().length > 100) errors.name = "Họ tên tối đa 100 ký tự.";
  if (!values.specialty.trim()) errors.specialty = "Vui lòng nhập chuyên khoa.";
  else if (values.specialty.trim().length > 100) errors.specialty = "Chuyên khoa tối đa 100 ký tự.";
  return errors;
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const listController = useRef(null);
  const detailController = useRef(null);
  const nameInput = useRef(null);
  const cancelDelete = useRef(null);

  const loadDoctors = useCallback(() => {
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    return getDoctors(controller.signal)
      .then((response) => {
        setDoctors(response.data);
        setListError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setListError(getApiError(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadDoctors();
    return () => {
      listController.current?.abort();
      detailController.current?.abort();
    };
  }, [loadDoctors]);

  useEffect(() => {
    if (deleteTarget) cancelDelete.current?.focus();
  }, [deleteTarget]);

  const busy = saving || deleting;
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const filteredDoctors = doctors.filter((doctor) =>
    `${doctor.name} ${doctor.specialty}`.toLocaleLowerCase("vi").includes(normalizedQuery),
  );

  function reloadDoctors() {
    setLoading(true);
    setListError("");
    loadDoctors();
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormError("");
  }

  function startEdit(doctor) {
    closeDetail();
    setEditingId(doctor.id);
    setForm({ name: doctor.name, specialty: doctor.specialty });
    setFormErrors({});
    setFormError("");
    setNotice("");
    nameInput.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const errors = validate(form);
    setFormErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;

    setSaving(true);
    setNotice("");
    const values = { name: form.name.trim(), specialty: form.specialty.trim() };
    try {
      const response = editingId === null
        ? await createDoctor(values)
        : await updateDoctor(editingId, values);
      const savedDoctor = response.data;
      setDoctors((current) => editingId === null
        ? [...current, savedDoctor]
        : current.map((doctor) => doctor.id === editingId ? savedDoctor : doctor));
      if (detail?.id === editingId) setDetail(savedDoctor);
      setNotice(editingId === null ? "Đã thêm bác sĩ thành công." : "Đã cập nhật thông tin bác sĩ.");
      resetForm();
    } catch (error) {
      setFormError(getApiError(error));
    } finally {
      setSaving(false);
    }
  }

  async function showDetail(id) {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await getDoctor(id, controller.signal);
      setDetail(response.data);
    } catch (error) {
      if (!controller.signal.aborted) setDetailError(getApiError(error));
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }

  function closeDetail() {
    detailController.current?.abort();
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setDeleting(true);
    setDeleteError("");
    setNotice("");
    try {
      await deleteDoctor(deleteTarget.id);
      setDoctors((current) => current.filter((doctor) => doctor.id !== deleteTarget.id));
      if (detail?.id === deleteTarget.id) closeDetail();
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      setNotice(`Đã xóa bác sĩ ${deleteTarget.name}.`);
    } catch (error) {
      setDeleteError(getApiError(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="doctors-page">
      <section className="doctors-heading" aria-labelledby="doctors-title">
        <div>
          <p className="eyebrow">ĐỘI NGŨ SUNCARE</p>
          <h1 id="doctors-title">Quản lý bác sĩ</h1>
          <p>Theo dõi và cập nhật thông tin đội ngũ bác sĩ tại SunCare.</p>
        </div>
        <div className="doctor-count"><strong>{doctors.length}</strong><span>bác sĩ trong danh sách</span></div>
      </section>

      {notice && <p className="feedback feedback-success" role="status">{notice}</p>}

      {deleteTarget && (
        <section className="delete-confirmation" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-description">
          <div>
            <h2 id="delete-title">Xóa bác sĩ?</h2>
            <p id="delete-description">Bạn có chắc muốn xóa <strong>{deleteTarget.name}</strong> khỏi danh sách?</p>
            {deleteError && <p className="field-error" role="alert">{deleteError}</p>}
          </div>
          <div className="button-group">
            <button ref={cancelDelete} className="button button-secondary" type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</button>
            <button className="button button-danger" type="button" disabled={deleting} onClick={confirmDelete}>{deleting ? "Đang xóa…" : "Xác nhận xóa"}</button>
          </div>
        </section>
      )}

      <div className="doctors-layout">
        <section className="doctor-list panel" aria-labelledby="doctor-list-title" aria-busy={loading}>
          <div className="panel-heading">
            <div><h2 id="doctor-list-title">Danh sách bác sĩ</h2><p>Thông tin họ tên và chuyên khoa</p></div>
            <button className="button button-secondary" type="button" onClick={reloadDoctors} disabled={loading || busy}>Tải lại</button>
          </div>
          <div className="doctor-search">
            <label htmlFor="doctor-search">Tìm bác sĩ</label>
            <input id="doctor-search" type="search" placeholder="Nhập tên hoặc chuyên khoa…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>

          {loading ? <p className="empty-state" role="status">Đang tải danh sách bác sĩ…</p>
            : listError ? <div className="list-error" role="alert"><p>{listError}</p><button className="button button-secondary" type="button" onClick={reloadDoctors}>Thử lại</button></div>
              : filteredDoctors.length === 0 ? <div className="empty-state"><h3>{query.trim() ? "Không tìm thấy bác sĩ" : "Chưa có bác sĩ nào"}</h3><p>{query.trim() ? "Hãy thử tên hoặc chuyên khoa khác." : "Thêm bác sĩ đầu tiên bằng biểu mẫu bên cạnh."}</p></div>
                : <div className="doctor-table-scroll"><table className="doctor-table">
                  <thead><tr><th scope="col">Bác sĩ</th><th scope="col">Chuyên khoa</th><th scope="col">Thao tác</th></tr></thead>
                  <tbody>{filteredDoctors.map((doctor) => <tr key={doctor.id} className={editingId === doctor.id ? "is-editing" : undefined}>
                    <td><div className="doctor-name"><span className="doctor-avatar" aria-hidden="true">{doctor.name.trim().split(/\s+/).at(-1)?.charAt(0).toLocaleUpperCase("vi")}</span><div><strong>{doctor.name}</strong><span>Mã bác sĩ #{doctor.id}</span></div></div></td>
                    <td><span className="specialty-tag">{doctor.specialty}</span></td>
                    <td><div className="row-actions">
                      <button type="button" disabled={busy || !!deleteTarget} onClick={() => showDetail(doctor.id)} aria-label={`Xem ${doctor.name}`}>Xem</button>
                      <button type="button" disabled={busy || !!deleteTarget} onClick={() => startEdit(doctor)} aria-label={`Sửa ${doctor.name}`}>Sửa</button>
                      <button className="delete-link" type="button" disabled={busy || !!deleteTarget} onClick={() => { closeDetail(); setDeleteTarget(doctor); setDeleteError(""); }} aria-label={`Xóa ${doctor.name}`}>Xóa</button>
                    </div></td>
                  </tr>)}</tbody>
                </table></div>}
        </section>

        <aside className="doctor-sidebar">
          <section className="panel doctor-form-panel" aria-labelledby="doctor-form-title">
            <div className="panel-heading"><div><p className="eyebrow">{editingId === null ? "THÊM MỚI" : `BÁC SĨ #${editingId}`}</p><h2 id="doctor-form-title">{editingId === null ? "Thêm bác sĩ" : "Chỉnh sửa bác sĩ"}</h2></div></div>
            <form className="doctor-form" onSubmit={handleSubmit} noValidate>
              <p className="form-hint">Các trường có dấu <span aria-hidden="true">*</span> là bắt buộc.</p>
              <div className="form-field">
                <label htmlFor="doctor-name">Họ tên bác sĩ <span aria-hidden="true">*</span></label>
                <input ref={nameInput} id="doctor-name" name="name" autoComplete="name" placeholder="Ví dụ: Nguyễn Văn An" required maxLength={100} value={form.name} disabled={busy || loading || !!listError || !!deleteTarget} aria-invalid={!!formErrors.name} aria-describedby={formErrors.name ? "name-error" : undefined} onChange={(event) => { setForm({ ...form, name: event.target.value }); setFormErrors({ ...formErrors, name: "" }); }} />
                {formErrors.name && <p className="field-error" id="name-error">{formErrors.name}</p>}
              </div>
              <div className="form-field">
                <label htmlFor="doctor-specialty">Chuyên khoa <span aria-hidden="true">*</span></label>
                <input id="doctor-specialty" name="specialty" placeholder="Ví dụ: Tim mạch" required maxLength={100} value={form.specialty} disabled={busy || loading || !!listError || !!deleteTarget} aria-invalid={!!formErrors.specialty} aria-describedby={formErrors.specialty ? "specialty-error" : undefined} onChange={(event) => { setForm({ ...form, specialty: event.target.value }); setFormErrors({ ...formErrors, specialty: "" }); }} />
                {formErrors.specialty && <p className="field-error" id="specialty-error">{formErrors.specialty}</p>}
              </div>
              {formError && <p className="feedback feedback-error" role="alert">{formError}</p>}
              <div className="form-actions">
                <button className="button button-primary" type="submit" disabled={busy || loading || !!listError || !!deleteTarget}>{saving ? "Đang lưu…" : editingId === null ? "Thêm bác sĩ" : "Lưu thay đổi"}</button>
                {editingId !== null && <button className="button button-secondary" type="button" disabled={busy} onClick={resetForm}>Hủy chỉnh sửa</button>}
              </div>
            </form>
          </section>

          {(detail || detailLoading || detailError) && <section className="panel doctor-detail" aria-labelledby="doctor-detail-title" aria-busy={detailLoading}>
            <div className="panel-heading"><h2 id="doctor-detail-title">Chi tiết bác sĩ</h2><button className="close-button" type="button" aria-label="Đóng chi tiết" onClick={closeDetail}>×</button></div>
            {detailLoading && <p role="status">Đang tải thông tin…</p>}
            {detailError && <p className="field-error" role="alert">{detailError}</p>}
            {detail && <dl><div><dt>Mã bác sĩ</dt><dd>#{detail.id}</dd></div><div><dt>Họ tên</dt><dd>{detail.name}</dd></div><div><dt>Chuyên khoa</dt><dd>{detail.specialty}</dd></div></dl>}
          </section>}
          <p className="doctor-sidebar-note">Cập nhật thông tin chính xác để dễ dàng tìm kiếm bác sĩ và chuyên khoa phù hợp.</p>
        </aside>
      </div>
    </main>
  );
}
