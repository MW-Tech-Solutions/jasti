import * as React from "react"
import { useNavigate } from "react-router-dom"
import { BarChart3, Users, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { journalApi } from "@/lib/journalApi"
import { toast } from "sonner"

type DashboardData = {
  user: {
    user_id: number
    first_name: string
    last_name: string
    email: string
  }
  editor_profile: {
    editor_type: string
    title: string
    status: string
    appointment_date: string
    subject_areas: string
    bio: string
  }
  stats: Record<string, number>
  access: Record<string, boolean>
}

export default function EditorDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadDashboard = async () => {
      try {
        const { data } = await journalApi.get("/editor/dashboard.php")
        setDashboard(data)
      } catch (error) {
        console.error("Failed to load editor dashboard", error)
        toast.error("Failed to load dashboard")
        navigate("/login/editor")
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [navigate])

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>
  }

  if (!dashboard) {
    return <div className="p-8">No dashboard data available</div>
  }

  const { editor_profile, stats, access } = dashboard

  const StatCard = ({ icon: Icon, label, value }: any) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <Icon className="w-10 h-10 text-blue-500 opacity-50" />
      </div>
    </div>
  )

  const getEditorDashboard = () => {
    switch (editor_profile.editor_type) {
      case "editor_in_chief":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Editor-in-Chief Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={FileText} label="Total Manuscripts" value={stats.total_manuscripts} />
              <StatCard icon={AlertCircle} label="Under Review" value={stats.pending_review} />
              <StatCard icon={CheckCircle2} label="Decisions Made" value={stats.decisions_made} />
              <StatCard icon={Users} label="Active Reviewers" value={stats.active_reviewers} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <ul className="space-y-3">
                  {access.can_view_submissions && (
                    <li>
                      <button
                        onClick={() => navigate("/editor/submissions")}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        → View All Manuscripts
                      </button>
                    </li>
                  )}
                  {access.can_view_decisions && (
                    <li>
                      <button
                        onClick={() => navigate("/editor/decisions")}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        → Make Editorial Decisions
                      </button>
                    </li>
                  )}
                  {access.can_view_reviewers && (
                    <li>
                      <button
                        onClick={() => navigate("/editor/reviewers")}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        → Manage Reviewers
                      </button>
                    </li>
                  )}
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <p className="text-gray-600 text-sm">No recent activity</p>
              </div>
            </div>
          </div>
        )

      case "section_editor":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Section Editor Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <StatCard icon={FileText} label="Assigned Manuscripts" value={stats.assigned_to_me} />
              <StatCard icon={AlertCircle} label="Pending Review" value={stats.pending_review} />
              <StatCard icon={Users} label="Area Specializations" value={0} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Assigned Manuscripts</h3>
                {access.can_view_submissions && (
                  <button
                    onClick={() => navigate("/editor/assignments")}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    → View my assignments
                  </button>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Subject Areas</h3>
                <p className="text-gray-600 text-sm">{editor_profile.subject_areas || "Not specified"}</p>
              </div>
            </div>
          </div>
        )

      case "managing_editor":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Managing Editor Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <StatCard icon={FileText} label="Total Manuscripts" value={stats.total_manuscripts} />
              <StatCard icon={AlertCircle} label="Awaiting Communication" value={stats.pending_review} />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <ul className="space-y-3">
                {access.can_view_submissions && (
                  <li>
                    <button
                      onClick={() => navigate("/editor/submissions")}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      → View Submissions
                    </button>
                  </li>
                )}
                <li>
                  <button className="text-blue-600 hover:text-blue-700 font-medium">→ Send Communications</button>
                </li>
                <li>
                  <button className="text-blue-600 hover:text-blue-700 font-medium">→ Workflow Management</button>
                </li>
              </ul>
            </div>
          </div>
        )

      case "technical_editor":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Technical Editor Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <StatCard icon={FileText} label="Formatting Tasks" value={stats.pending_review} />
              <StatCard icon={CheckCircle2} label="Completed" value={0} />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              {access.can_view_formatting && (
                <button
                  onClick={() => navigate("/editor/formatting")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  → View Formatting Tasks
                </button>
              )}
            </div>
          </div>
        )

      case "reviewer":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Reviewer Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <StatCard icon={FileText} label="Assigned Reviews" value={stats.assigned_to_me} />
              <StatCard icon={CheckCircle2} label="Completed Reviews" value={stats.decisions_made} />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => navigate("/reviewer/invitations")}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    → View Review Invitations
                  </button>
                </li>
                <li>
                  <button className="text-blue-600 hover:text-blue-700 font-medium">→ My Reviews</button>
                </li>
              </ul>
            </div>
          </div>
        )

      default:
        return <div>Unknown editor type</div>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {dashboard.user.first_name} {dashboard.user.last_name}
              </h1>
              <p className="text-gray-600 mt-1">{editor_profile.title}</p>
              <div className="mt-3 flex gap-4">
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm capitalize">
                  {editor_profile.status}
                </span>
                <span className="text-sm text-gray-500">
                  Appointed: {new Date(editor_profile.appointment_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {getEditorDashboard()}
      </div>
    </div>
  )
}
