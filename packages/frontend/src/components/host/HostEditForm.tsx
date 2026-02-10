import type { FormEvent } from 'react'

interface EditForm {
  name: string
  type: 'vm' | 'ct'
  proxmox_vmid: string
  ip_address: string
  ssh_port: string
  ssh_user: string
  ssh_key_path: string
  has_docker: boolean
  has_crowdsec: boolean
}

interface HostEditFormProps {
  editForm: EditForm
  saving: boolean
  onEditFormChange: (form: EditForm) => void
  onSave: (e: FormEvent) => void
}

export default function HostEditForm({ editForm, saving, onEditFormChange, onSave }: HostEditFormProps) {
  return (
    <div className="settings-section" style={{ marginBottom: 24 }}>
      <h2>Edit Host</h2>
      <form onSubmit={onSave}>
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => onEditFormChange({ ...editForm, name: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select
            value={editForm.type}
            onChange={(e) => onEditFormChange({ ...editForm, type: e.target.value as 'vm' | 'ct' })}
          >
            <option value="vm">VM</option>
            <option value="ct">CT</option>
          </select>
        </div>
        <div className="form-group">
          <label>Proxmox VMID (optional)</label>
          <input
            type="text"
            value={editForm.proxmox_vmid}
            onChange={(e) => onEditFormChange({ ...editForm, proxmox_vmid: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>IP Address</label>
          <input
            type="text"
            value={editForm.ip_address}
            onChange={(e) => onEditFormChange({ ...editForm, ip_address: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>SSH Port</label>
          <input
            type="text"
            value={editForm.ssh_port}
            onChange={(e) => onEditFormChange({ ...editForm, ssh_port: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>SSH User</label>
          <input
            type="text"
            value={editForm.ssh_user}
            onChange={(e) => onEditFormChange({ ...editForm, ssh_user: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>SSH Key Path</label>
          <input
            type="text"
            value={editForm.ssh_key_path}
            onChange={(e) => onEditFormChange({ ...editForm, ssh_key_path: e.target.value })}
          />
        </div>
        <div className="checkbox-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={editForm.has_docker}
              onChange={(e) => onEditFormChange({ ...editForm, has_docker: e.target.checked })}
            />
            Has Docker
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={editForm.has_crowdsec}
              onChange={(e) => onEditFormChange({ ...editForm, has_crowdsec: e.target.checked })}
            />
            Has CrowdSec
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
