import * as React from "react"
import { Edit2, Plus, RefreshCw, UserRound, X } from "lucide-react"

import type { AdminUser } from "@/admin/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type UserFormState = {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: string
  isActive: boolean
  passport: string
}

type UsersTabProps = {
  users: AdminUser[]
  query: string
  onQueryChange: (value: string) => void
  userForm: UserFormState
  onUserFieldChange: (field: keyof UserFormState, value: string | boolean) => void
  onSaveUser: () => void
  onCancelEdit: () => void
  onEditUser: (user: AdminUser) => void
  onUserPassportFile: (file?: File | null) => void
  onRefreshUsers: () => void
  editingUserId: string | null
  loadingUsers: boolean
  savingUser: boolean
}

const formatDateTime = (value?: string) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export function UsersTab({
  users,
  query,
  onQueryChange,
  userForm,
  onUserFieldChange,
  onSaveUser,
  onCancelEdit,
  onEditUser,
  onUserPassportFile,
  onRefreshUsers,
  editingUserId,
  loadingUsers,
  savingUser,
}: UsersTabProps) {
  const isEditing = Boolean(editingUserId)
  const [showUserForm, setShowUserForm] = React.useState(false)
  const isUserFormVisible = showUserForm || isEditing

  const filteredUsers = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized) ||
        user.role.toLowerCase().includes(normalized)
      )
    })
  }, [query, users])

  React.useEffect(() => {
    if (!isEditing) return
    setShowUserForm(true)
  }, [isEditing])

  const handleOpenCreateUserForm = React.useCallback(() => {
    onCancelEdit()
    setShowUserForm(true)
  }, [onCancelEdit])

  const handleCloseUserForm = React.useCallback(() => {
    onCancelEdit()
    setShowUserForm(false)
  }, [onCancelEdit])

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">Manage Users</CardTitle>
            <CardDescription className="mt-1">Create, update, and list admin users.</CardDescription>
          </div>
          <Button variant="outline" onClick={onRefreshUsers} disabled={loadingUsers} className="w-full md:w-auto">
            <RefreshCw className={`h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
            {loadingUsers ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {!isUserFormVisible && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">User form is hidden. Open it only when you need to add a user.</p>
            <Button onClick={handleOpenCreateUserForm} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> New User
            </Button>
          </div>
        )}

        {isUserFormVisible && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-800">
                {isEditing ? "Update User" : "Create New User"}
              </p>
              <Button
                variant="outline"
                onClick={handleCloseUserForm}
                disabled={savingUser}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4" /> {isEditing ? "Cancel Edit" : "Close Form"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={userForm.name}
                  onChange={(event) => onUserFieldChange("name", event.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(event) => onUserFieldChange("email", event.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label>{isEditing ? "New Password (optional)" : "Password"}</Label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => onUserFieldChange("password", event.target.value)}
                  placeholder={isEditing ? "Leave blank to keep current password" : "At least 6 characters"}
                  autoComplete={isEditing ? "new-password" : "off"}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEditing ? "Confirm New Password" : "Confirm Password"}</Label>
                <Input
                  type="password"
                  value={userForm.confirmPassword}
                  onChange={(event) => onUserFieldChange("confirmPassword", event.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={userForm.role}
                  onChange={(event) => onUserFieldChange("role", event.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(event) => onUserFieldChange("isActive", event.target.checked)}
                    className="h-4 w-4"
                  />
                  Active Account
                </label>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Passport Photo (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    onUserPassportFile(file)
                    event.currentTarget.value = ""
                  }}
                />
                {userForm.passport && (
                  <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2">
                    <img
                      src={userForm.passport}
                      alt="User passport preview"
                      className="h-14 w-14 rounded-md border border-slate-200 object-cover"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onUserFieldChange("passport", "")}
                      disabled={savingUser}
                    >
                      Remove Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button onClick={onSaveUser} disabled={savingUser} className="w-full sm:w-auto">
                <UserRound className="h-4 w-4" />
                {savingUser ? "Saving..." : isEditing ? "Update User" : "Create User"}
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Search by name, email, or role"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="bg-white"
          />
          <div className="flex items-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-600">
            Total: <span className="ml-1 font-semibold text-slate-900">{filteredUsers.length}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-auto">
            <table className="min-w-[980px] w-full table-auto text-sm">
              <thead className="bg-slate-100">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">Passport</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`border-t border-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                  >
                    <td className="px-4 py-3">
                      {user.passport ? (
                        <img
                          src={user.passport}
                          alt={`${user.name || "User"} passport`}
                          className="h-10 w-10 rounded-md border border-slate-200 object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No photo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{user.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{user.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{user.role || "user"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(user.lastLogin)}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowUserForm(true)
                          onEditUser(user)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {loadingUsers ? "Loading users..." : "No users matched your search."}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
