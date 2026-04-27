import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, ChevronRight, RefreshCw, Users } from 'lucide-react';

import { api } from '../../../../api.js';

function MemberItem({ member, canManage, onEdit, onDeactivate, onDelete, onResetPassword, onTransferTasks }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-[var(--app-border)] last:border-0 hover:bg-[var(--app-panel-soft)] transition-colors">
      <div className="size-8 rounded-full bg-[var(--app-primary)]/10 grid place-items-center text-[var(--app-primary)]">
        <span className="text-[13px] font-medium">
          {(member.display_name || member.first_name || member.username)?.[0]?.toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-medium text-[var(--app-text)]">
          {member.display_name || member.first_name || member.username}
        </span>
        <span className="text-[13px] text-[var(--app-subtle)] ml-2">@{member.username}</span>
      </div>

      <span className={`text-[13px] px-2.5 py-1 rounded-full font-medium ${
        member.role === 'super_admin'
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
          : member.role === 'department_manager'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
            : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
      }`}>
        {member.role === 'super_admin' ? '超管'
          : member.role === 'department_manager' ? '负责人'
            : '成员'}
      </span>

      {canManage && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-muted)] hover:bg-[var(--app-panel)] transition-colors"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={onTransferTasks}
            className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
          >
            转移
          </button>
          <button
            type="button"
            onClick={onDeactivate}
            className="rounded-[6px] px-2 py-1 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            禁用
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-[6px] px-2 py-1 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            删除
          </button>
          <button
            type="button"
            onClick={onResetPassword}
            className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-muted)] hover:bg-[var(--app-panel)] transition-colors"
          >
            重置密码
          </button>
        </div>
      )}
    </div>
  );
}

function DeptTreeNode({
  dept,
  isSuperAdmin,
  managedDeptIds,
  onCreateChild,
  onEditDept,
  onCreateMember,
  onEditMember,
  onDeactivateDept,
  onDeactivateMember,
  onDeleteMember,
  onResetPassword,
  onTransferTasks,
  expandedDepts,
  toggleExpand,
  membersByDept,
  loadingMembers,
  level = 0
}) {
  const canManage = isSuperAdmin || managedDeptIds.includes(dept.id);
  const hasChildren = dept.children?.length > 0;
  const isExpanded = expandedDepts[dept.id];
  const members = membersByDept[dept.id] || [];
  const isLoading = loadingMembers[dept.id];
  const canDeactivate = canManage && !hasChildren && (dept.member_count === 0);

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-3 py-3 px-4 rounded-[10px]
          bg-[var(--app-panel)] border border-[var(--app-border)]
          transition-all duration-200
          ${level > 0 ? 'ml-7 mt-1' : ''}
          hover:shadow-[var(--shadow-sm)]`}
      >
        <button
          type="button"
          onClick={() => toggleExpand(dept.id)}
          className="flex size-6 items-center justify-center rounded-[6px]
            text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]
            hover:text-[var(--app-text)] transition-colors"
        >
          <ChevronRight
            size={16}
            strokeWidth={1.5}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        <Building2 size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />

        <span className="flex-1 text-[15px] font-medium text-[var(--app-text)]">
          {dept.name}
        </span>

        {dept.manager && (
          <span className="text-[13px] text-[var(--app-subtle)]">
            {dept.manager.display_name || dept.manager.first_name || dept.manager.username}
          </span>
        )}

        <span className="text-[13px] text-[var(--app-muted)] tabular-nums">
          {dept.member_count || 0} 人
        </span>

        {canManage && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onCreateChild(dept.id)}
              className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
            >
              新增子部门
            </button>
            <button
              type="button"
              onClick={() => onEditDept(dept)}
              className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              编辑
            </button>
            {canDeactivate && (
              <button
                type="button"
                onClick={() => onDeactivateDept(dept)}
                className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                禁用
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={`ml-7 mt-1 ${level > 0 ? '' : ''}`}>
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] overflow-hidden">
            {isLoading ? (
              <div className="py-6 text-center text-[var(--app-muted)]">
                <RefreshCw size={16} className="animate-spin mx-auto" />
                <span className="mt-2 text-[13px]">加载成员...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="py-6 text-center text-[var(--app-subtle)]">
                <Users size={20} strokeWidth={1.5} className="mx-auto opacity-50" />
                <span className="mt-2 text-[13px]">暂无成员</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onCreateMember(dept.id)}
                    className="mt-3 text-[13px] text-[var(--app-primary)] hover:underline"
                  >
                    添加成员
                  </button>
                )}
              </div>
            ) : (
              <>
                {members.map(member => (
                  <MemberItem
                    key={member.id}
                    member={member}
                    canManage={member.can_manage}
                    onEdit={() => onEditMember(member)}
                    onDeactivate={() => onDeactivateMember(member)}
                    onDelete={() => onDeleteMember(member)}
                    onResetPassword={() => onResetPassword(member)}
                    onTransferTasks={() => onTransferTasks(member)}
                  />
                ))}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onCreateMember(dept.id)}
                    className="w-full py-2.5 text-[13px] text-[var(--app-primary)]
                      border-t border-[var(--app-border)]
                      hover:bg-[var(--app-primary)]/10 transition-colors"
                  >
                    + 新增成员
                  </button>
                )}
              </>
            )}
          </div>

          {hasChildren && (
            <div className="mt-2 border-l-2 border-[var(--app-border)] pl-2">
              {dept.children.map(child => (
                <DeptTreeNode
                  key={child.id}
                  dept={child}
                  isSuperAdmin={isSuperAdmin}
                  managedDeptIds={managedDeptIds}
                  onCreateChild={onCreateChild}
                  onEditDept={onEditDept}
                  onCreateMember={onCreateMember}
                  onEditMember={onEditMember}
                  onDeactivateDept={onDeactivateDept}
                  onDeactivateMember={onDeactivateMember}
                  onDeleteMember={onDeleteMember}
                  onResetPassword={onResetPassword}
                  onTransferTasks={onTransferTasks}
                  expandedDepts={expandedDepts}
                  toggleExpand={toggleExpand}
                  membersByDept={membersByDept}
                  loadingMembers={loadingMembers}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ open, action, onConfirm, onClose }) {
  if (!open || !action) return null;

  const isDept = action.type.includes('dept');
  const isDelete = action.type === 'delete_user';
  const isActivate = action.type.includes('activate');

  const getTitle = () => {
    if (isActivate && isDept) return '确认启用部门';
    if (isActivate) return '确认启用用户';
    if (isDept) return '确认禁用部门';
    if (isDelete) return '确认删除用户';
    return '确认禁用成员';
  };

  const getMessage = () => {
    if (isActivate && isDept) return `启用后，「${action.target.name}」将重新显示。`;
    if (isActivate) return `启用后，${action.target.display_name || action.target.username} 将可以登录系统。`;
    if (isDept) return `禁用后，「${action.target.name}」将不再显示。此操作可恢复。`;
    if (isDelete) return `删除后，${action.target.display_name || action.target.username} 的所有数据将被永久删除。`;
    return `禁用后，${action.target.display_name || action.target.username} 将无法登录系统。此操作可恢复。`;
  };

  const getButtonLabel = () => {
    if (isActivate) return '确认启用';
    if (isDelete) return '确认删除';
    return '确认禁用';
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[360px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)]">{getTitle()}</h2>
        <p className="mt-3 text-[15px] text-[var(--app-muted)]">{getMessage()}</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 rounded-[10px] px-4 text-[15px] font-medium text-white transition-colors ${
              isActivate ? 'bg-[var(--app-primary)] hover:bg-[var(--app-primary-strong)]'
                : isDelete ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {getButtonLabel()}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PasswordResetModal({ targetUser, onClose, onSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setError('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.resetUserPassword(targetUser.id, { new_password: newPassword });
      onSuccess();
    } catch (err) {
      setError(err.message || '重置失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[360px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)]">重置密码</h2>
        <p className="mt-2 text-[13px] text-[var(--app-muted)]">
          为 @{targetUser?.username} 设置新密码
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="输入新密码"
            className="w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
            autoFocus
          />

          {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function TransferDepartmentModal({ targetUser, deptTree, onClose, onSuccess }) {
  const [departmentId, setDepartmentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function getAllDepts(depts, result = []) {
    for (const d of depts) {
      result.push(d);
      if (d.children?.length > 0) {
        getAllDepts(d.children, result);
      }
    }
    return result;
  }

  const allDepts = getAllDepts(deptTree);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateOrgUser(targetUser.id, { department_id: departmentId || null });
      onSuccess();
    } catch (err) {
      setError(err.message || '转移失败');
    } finally {
      setSaving(false);
    }
  };

  const currentDeptName = targetUser?.default_department?.name || '未分配部门';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)]">转移部门</h2>
        <p className="mt-2 text-[13px] text-[var(--app-muted)]">
          {targetUser?.display_name || targetUser?.username} 当前在「{currentDeptName}」
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className="text-[13px] font-medium text-[var(--app-text)]">转移目标部门</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
          >
            <option value="">未分配部门</option>
            {allDepts.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '转移中...' : '确认转移'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function OrganizationPage({ user }) {
  const [deptTree, setDeptTree] = useState([]);
  const [noDeptUsers, setNoDeptUsers] = useState([]);
  const [inactiveDepts, setInactiveDepts] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [expandedDepts, setExpandedDepts] = useState({});
  const [membersByDept, setMembersByDept] = useState({});
  const [loadingMembers, setLoadingMembers] = useState({});

  const [deptEditOpen, setDeptEditOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptCreateOpen, setDeptCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState(null);

  const [userEditOpen, setUserEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userCreateOpen, setUserCreateOpen] = useState(false);
  const [createMemberDeptId, setCreateMemberDeptId] = useState(null);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);

  const [transferTasksOpen, setTransferTasksOpen] = useState(false);
  const [transferTargetUser, setTransferTargetUser] = useState(null);

  const isSuperAdmin = user?.is_super_admin;
  const managedDeptIds = user?.managed_department_ids || [];

  const loadDeptTree = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.departmentTree();
      setDeptTree(data);
    } catch (e) {
      setError(e.message || '加载部门树失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNoDeptUsers = useCallback(async () => {
    try {
      const data = await api.orgUsers({ no_department: true });
      setNoDeptUsers(data);
    } catch (e) {
      console.error('加载无部门用户失败:', e);
    }
  }, []);

  const loadInactiveDepts = useCallback(async () => {
    try {
      const data = await api.inactiveDepartments();
      setInactiveDepts(data);
    } catch (e) {
      console.error('加载禁用部门失败:', e);
    }
  }, []);

  const loadInactiveUsers = useCallback(async () => {
    try {
      const data = await api.orgUsers({ include_inactive: true });
      setInactiveUsers(data.filter(u => u.is_active === false));
    } catch (e) {
      console.error('加载禁用用户失败:', e);
    }
  }, []);

  const loadDeptMembers = useCallback(async (deptId) => {
    if (membersByDept[deptId]) return;
    setLoadingMembers(prev => ({ ...prev, [deptId]: true }));
    try {
      const data = await api.orgUsers({ department_id: deptId });
      setMembersByDept(prev => ({ ...prev, [deptId]: data }));
    } catch (e) {
      console.error('加载成员失败:', e);
    } finally {
      setLoadingMembers(prev => ({ ...prev, [deptId]: false }));
    }
  }, [membersByDept]);

  const toggleExpand = useCallback((deptId) => {
    const newExpanded = !expandedDepts[deptId];
    setExpandedDepts(prev => ({ ...prev, [deptId]: newExpanded }));
    if (newExpanded) {
      loadDeptMembers(deptId);
    }
  }, [expandedDepts, loadDeptMembers]);

  useEffect(() => {
    if (user?.is_super_admin || user?.is_department_manager) {
      loadDeptTree();
      loadNoDeptUsers();
    }
    if (user?.is_super_admin) {
      loadInactiveDepts();
      loadInactiveUsers();
    }
  }, [user, loadDeptTree, loadNoDeptUsers, loadInactiveDepts, loadInactiveUsers]);

  const handleDeactivateDept = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.deactivateDepartment(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      loadDeptTree();
      setMembersByDept({});
      loadInactiveDepts();
    } catch (e) {
      setError(e.message || '禁用失败');
    }
  };

  const handleDeactivateMember = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.deactivateOrgUser(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      setMembersByDept({});
      loadDeptTree();
      loadNoDeptUsers();
      loadInactiveUsers();
    } catch (e) {
      setError(e.message || '禁用失败');
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.deleteOrgUser(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      setMembersByDept({});
      loadDeptTree();
      loadNoDeptUsers();
      loadInactiveUsers();
    } catch (e) {
      setError(e.message || '删除失败');
    }
  };

  const handleActivateDept = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.activateDepartment(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      loadDeptTree();
      loadInactiveDepts();
    } catch (e) {
      setError(e.message || '启用失败');
    }
  };

  const handleActivateUser = async () => {
    if (!confirmAction?.target) return;
    try {
      await api.activateOrgUser(confirmAction.target.id);
      setConfirmDialogOpen(false);
      setConfirmAction(null);
      setMembersByDept({});
      loadDeptTree();
      loadNoDeptUsers();
      loadInactiveUsers();
    } catch (e) {
      setError(e.message || '启用失败');
    }
  };

  const openDeactivateDeptDialog = (dept) => {
    setConfirmAction({ type: 'deactivate_dept', target: dept });
    setConfirmDialogOpen(true);
  };

  const openDeactivateMemberDialog = (member) => {
    setConfirmAction({ type: 'deactivate_member', target: member });
    setConfirmDialogOpen(true);
  };

  const openDeleteUserDialog = (member) => {
    setConfirmAction({ type: 'delete_user', target: member });
    setConfirmDialogOpen(true);
  };

  const openActivateDeptDialog = (dept) => {
    setConfirmAction({ type: 'activate_dept', target: dept });
    setConfirmDialogOpen(true);
  };

  const openActivateUserDialog = (member) => {
    setConfirmAction({ type: 'activate_user', target: member });
    setConfirmDialogOpen(true);
  };

  const openPasswordResetModal = (member) => {
    setResetTargetUser(member);
    setPasswordResetOpen(true);
  };

  const openTransferDepartmentModal = (member) => {
    setTransferTargetUser(member);
    setTransferTasksOpen(true);
  };

  const renderDeptTree = (depts) => {
    return depts.map(dept => (
      <DeptTreeNode
        key={dept.id}
        dept={dept}
        isSuperAdmin={isSuperAdmin}
        managedDeptIds={managedDeptIds}
        onCreateChild={(parentId) => {
          setCreateParentId(parentId);
          setDeptCreateOpen(true);
        }}
        onEditDept={(currentDept) => {
          setEditingDept(currentDept);
          setDeptEditOpen(true);
        }}
        onCreateMember={(deptId) => {
          setCreateMemberDeptId(deptId);
          setUserCreateOpen(true);
        }}
        onEditMember={(member) => {
          setEditingUser(member);
          setUserEditOpen(true);
        }}
        onDeactivateDept={openDeactivateDeptDialog}
        onDeactivateMember={openDeactivateMemberDialog}
        onDeleteMember={openDeleteUserDialog}
        onResetPassword={openPasswordResetModal}
        onTransferTasks={openTransferDepartmentModal}
        expandedDepts={expandedDepts}
        toggleExpand={toggleExpand}
        membersByDept={membersByDept}
        loadingMembers={loadingMembers}
      />
    ));
  };

  const handleConfirmAction = () => {
    if (confirmAction?.type === 'deactivate_dept') {
      handleDeactivateDept();
    } else if (confirmAction?.type === 'deactivate_member') {
      handleDeactivateMember();
    } else if (confirmAction?.type === 'delete_user') {
      handleDeleteUser();
    } else if (confirmAction?.type === 'activate_dept') {
      handleActivateDept();
    } else if (confirmAction?.type === 'activate_user') {
      handleActivateUser();
    }
  };

  return (
    <div className="h-full overflow-auto bg-[var(--app-bg)] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-semibold text-[var(--app-text)]">组织管理</h1>
          <p className="mt-0.5 text-[13px] text-[var(--app-muted)]">管理部门架构和成员信息</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-2 text-[13px] text-[var(--app-muted)]">
              <RefreshCw size={14} className="animate-spin" />
              加载中...
            </span>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setCreateParentId(null);
                setDeptCreateOpen(true);
              }}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] transition-colors"
            >
              + 新增顶级部门
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] bg-red-50 dark:bg-red-500/10 px-4 py-3 text-[13px] text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
        {deptTree.length === 0 ? (
          <div className="text-center text-[var(--app-muted)] py-12">
            <Building2 size={32} strokeWidth={1.5} className="mx-auto mb-3 opacity-50" />
            <p className="text-[15px]">暂无部门数据</p>
          </div>
        ) : (
          <div className="space-y-1">
            {renderDeptTree(deptTree)}
          </div>
        )}
      </div>

      {noDeptUsers.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <Users size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--app-text)]">无部门用户</h3>
            <span className="text-[13px] text-[var(--app-muted)]">{noDeptUsers.length} 人</span>
          </div>
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)]">
            {noDeptUsers.map(member => (
              <MemberItem
                key={member.id}
                member={member}
                canManage={member.can_manage}
                onEdit={() => {
                  setEditingUser(member);
                  setUserEditOpen(true);
                }}
                onDeactivate={() => openDeactivateMemberDialog(member)}
                onDelete={() => openDeleteUserDialog(member)}
                onResetPassword={() => openPasswordResetModal(member)}
                onTransferTasks={() => openTransferDepartmentModal(member)}
              />
            ))}
          </div>
        </div>
      )}

      {isSuperAdmin && inactiveDepts.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <Building2 size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--app-text)]">已禁用的部门</h3>
            <span className="text-[13px] text-[var(--app-muted)]">{inactiveDepts.length} 个</span>
          </div>
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)]">
            {inactiveDepts.map(dept => (
              <div key={dept.id} className="flex items-center gap-4 py-3 px-4 border-b border-[var(--app-border)] last:border-0">
                <span className="text-[15px] font-medium text-[var(--app-text)]">{dept.name}</span>
                {dept.parent_name && (
                  <span className="text-[13px] text-[var(--app-subtle)]">(原上级: {dept.parent_name})</span>
                )}
                <span className="text-[13px] text-[var(--app-muted)]">{dept.member_count || 0} 人</span>
                <button
                  type="button"
                  onClick={() => openActivateDeptDialog(dept)}
                  className="ml-auto rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
                >
                  启用
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSuperAdmin && inactiveUsers.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <Users size={16} strokeWidth={1.5} className="text-[var(--app-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--app-text)]">已禁用的用户</h3>
            <span className="text-[13px] text-[var(--app-muted)]">{inactiveUsers.length} 人</span>
          </div>
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)]">
            {inactiveUsers.map(currentUser => (
              <div key={currentUser.id} className="flex items-center gap-4 py-3 px-4 border-b border-[var(--app-border)] last:border-0">
                <div className="size-8 rounded-full bg-[var(--app-muted)]/20 grid place-items-center text-[var(--app-muted)]">
                  <span className="text-[13px] font-medium">
                    {(currentUser.display_name || currentUser.username)?.[0]?.toUpperCase()}
                  </span>
                </div>
                <span className="text-[15px] font-medium text-[var(--app-muted)]">
                  {currentUser.display_name || currentUser.username}
                </span>
                <span className="text-[13px] text-[var(--app-subtle)]">@{currentUser.username}</span>
                <button
                  type="button"
                  onClick={() => openTransferDepartmentModal(currentUser)}
                  className="rounded-[6px] px-2 py-1 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
                >
                  转移
                </button>
                <button
                  type="button"
                  onClick={() => openActivateUserDialog(currentUser)}
                  className="rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--app-primary)] hover:bg-[var(--app-primary)]/10 transition-colors"
                >
                  启用
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialogOpen}
        action={confirmAction}
        onConfirm={handleConfirmAction}
        onClose={() => {
          setConfirmDialogOpen(false);
          setConfirmAction(null);
        }}
      />

      {passwordResetOpen && (
        <PasswordResetModal
          targetUser={resetTargetUser}
          onClose={() => {
            setPasswordResetOpen(false);
            setResetTargetUser(null);
          }}
          onSuccess={() => {
            setPasswordResetOpen(false);
            setResetTargetUser(null);
          }}
        />
      )}

      {transferTasksOpen && (
        <TransferDepartmentModal
          targetUser={transferTargetUser}
          deptTree={deptTree}
          onClose={() => {
            setTransferTasksOpen(false);
            setTransferTargetUser(null);
          }}
          onSuccess={() => {
            setTransferTasksOpen(false);
            setTransferTargetUser(null);
            setMembersByDept({});
            loadDeptTree();
            loadNoDeptUsers();
            loadInactiveUsers();
          }}
        />
      )}

      {deptEditOpen && (
        <DeptEditModal
          dept={editingDept}
          deptTree={deptTree}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setDeptEditOpen(false);
            setEditingDept(null);
          }}
          onSuccess={() => {
            loadDeptTree();
            setMembersByDept({});
            setDeptEditOpen(false);
            setEditingDept(null);
          }}
        />
      )}

      {deptCreateOpen && (
        <DeptCreateModal
          parentId={createParentId}
          deptTree={deptTree}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setDeptCreateOpen(false);
            setCreateParentId(null);
          }}
          onSuccess={() => {
            loadDeptTree();
            setDeptCreateOpen(false);
            setCreateParentId(null);
          }}
        />
      )}

      {userEditOpen && (
        <UserEditModal
          targetUser={editingUser}
          deptTree={deptTree}
          isSuperAdmin={isSuperAdmin}
          onClose={() => {
            setUserEditOpen(false);
            setEditingUser(null);
          }}
          onSuccess={() => {
            setMembersByDept({});
            loadDeptTree();
            setUserEditOpen(false);
            setEditingUser(null);
          }}
        />
      )}

      {userCreateOpen && (
        <UserCreateModal
          deptTree={deptTree}
          defaultDeptId={createMemberDeptId}
          isSuperAdmin={isSuperAdmin}
          managedDeptIds={managedDeptIds}
          onClose={() => {
            setUserCreateOpen(false);
            setCreateMemberDeptId(null);
          }}
          onSuccess={() => {
            setMembersByDept({});
            loadDeptTree();
            setUserCreateOpen(false);
            setCreateMemberDeptId(null);
          }}
        />
      )}
    </div>
  );
}

function DeptEditModal({ dept, isSuperAdmin, onClose, onSuccess }) {
  const [name, setName] = useState(dept?.name || '');
  const [code, setCode] = useState(dept?.code || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateDepartment(dept.id, {
        name: name.trim(),
        code: code.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)] mb-4">编辑部门</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门代码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
            />
          </div>

          {dept?.manager && (
            <div>
              <label className="text-[13px] font-medium text-[var(--app-text)]">部门负责人</label>
              <div className="mt-1.5 text-[15px] text-[var(--app-muted)]">
                {dept.manager.display_name || dept.manager.first_name || dept.manager.username}
              </div>
            </div>
          )}

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function DeptCreateModal({ parentId, deptTree, isSuperAdmin, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const findDept = (depts, id) => {
    for (const d of depts) {
      if (d.id === id) return d;
      if (d.children?.length > 0) {
        const found = findDept(d.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  const parentDept = parentId ? findDept(deptTree, parentId) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createDepartment({
        name: name.trim(),
        code: code.trim(),
        parent_id: parentId || null,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)] mb-2">
          {parentDept ? `在「${parentDept.name}」下新增子部门` : '新增顶级部门'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">部门代码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              required
            />
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function UserEditModal({ targetUser, deptTree, isSuperAdmin, onClose, onSuccess }) {
  const [displayName, setDisplayName] = useState(targetUser?.first_name || '');
  const [departmentId, setDepartmentId] = useState(targetUser?.default_department?.id || '');
  const [role, setRole] = useState(targetUser?.role || 'member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function getAllDepts(depts, result = []) {
    for (const d of depts) {
      result.push(d);
      if (d.children?.length > 0) {
        getAllDepts(d.children, result);
      }
    }
    return result;
  }

  const allDepts = getAllDepts(deptTree);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateOrgUser(targetUser.id, {
        display_name: displayName.trim(),
        department_id: departmentId || null,
        role: role,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--app-text)] mb-4">编辑成员</h2>

        <div className="mb-4 text-[13px] text-[var(--app-muted)]">
          用户名：@{targetUser?.username}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-[var(--app-text)]">所属部门</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
            >
              <option value="">未分配</option>
              {allDepts.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="text-[13px] font-medium text-[var(--app-text)]">角色</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-[15px] outline-none focus:border-[var(--app-primary)]"
              >
                <option value="member">普通成员</option>
                <option value="department_manager">部门负责人</option>
                <option value="super_admin">超级管理员</option>
              </select>
            </div>
          )}

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[10px] px-4 text-[15px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[var(--app-primary)] px-4 text-[15px] font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function UserCreateModal({ deptTree, defaultDeptId, isSuperAdmin, managedDeptIds, onClose, onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [departmentId, setDepartmentId] = useState(defaultDeptId || '');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function getAllDepts(depts, result = []) {
    for (const d of depts) {
      result.push(d);
      if (d.children?.length > 0) {
        getAllDepts(d.children, result);
      }
    }
    return result;
  }

  const allDepts = getAllDepts(deptTree);
  const availableDepts = isSuperAdmin
    ? allDepts
    : allDepts.filter(d => managedDeptIds.includes(d.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createOrgUser({
        username: username.trim(),
        password: password,
        display_name: displayName.trim(),
        department_id: departmentId || null,
        role: role,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[400px] rounded-[16px] bg-[var(--app-panel)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">新增成员</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">用户名 *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">密码 *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">所属部门</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
            >
              <option value="">未分配</option>
              {availableDepts.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="text-sm font-medium">角色</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm"
              >
                <option value="member">普通成员</option>
                <option value="department_manager">部门负责人</option>
                <option value="super_admin">超级管理员</option>
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] px-4 py-2 text-sm text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[8px] bg-[var(--app-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--app-primary-strong)] disabled:opacity-50"
            >
              {saving ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
