import React, { useEffect, useState } from "react";
import { fetchEvents, fetchEventSources, createEvent, createEventTeam, updateEventStatus, deleteEvent, deleteTeam, setFeaturedEvent, settleEventRewards, EventSource } from "../../services/eventApi";
import { Event } from "../../types";
import { QRCodeModal } from "../../components/QRCodeModal";
import { Trash2, Trophy } from "lucide-react";
import toast from "react-hot-toast";



export const AdminEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [sources, setSources] = useState<EventSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeQr, setActiveQr] = useState<{ eventId: string; joinCode?: string } | null>(null);
  const [teamModalEventId, setTeamModalEventId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sourceId, setSourceId] = useState("ALL");
  const [targetLanguage, setTargetLanguage] = useState("all");
  const [goalMode, setGoalMode] = useState<"FIXED" | "HIGHEST">("HIGHEST");
  const [targetCount, setTargetCount] = useState<number>(100);
  const [rewardTitle, setRewardTitle] = useState("");
  const [hasTeams, setHasTeams] = useState(true);

  // Team Form states
  const [teamName, setTeamName] = useState("");
  const [teamImageUrl, setTeamImageUrl] = useState("");

  const loadEvents = () => {
    setLoading(true);
    Promise.all([fetchEvents(), fetchEventSources()])
      .then(([eventsData, sourcesData]) => {
        setEvents(eventsData);
        setSources(sourcesData);
      })
      .catch((err) => toast.error(err.message || "Failed to load events data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      toast.error("Please fill in title, start date, and end date.");
      return;
    }
    try {
      await createEvent({
        title,
        description,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        sourceId: sourceId === "ALL" ? undefined : sourceId,
        targetLanguage,
        targetCount: goalMode === "HIGHEST" ? 0 : targetCount,
        rewardTitle,
        hasTeams,
      });
      toast.success("Competition created successfully!");
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setSourceId("ALL");
      setTargetLanguage("all");
      setGoalMode("HIGHEST");
      setTargetCount(100);
      setRewardTitle("");
      setHasTeams(true);
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamModalEventId || !teamName) return;
    try {
      await createEventTeam(teamModalEventId, teamName, teamImageUrl || undefined);
      toast.success("Team created successfully!");
      setTeamModalEventId(null);
      setTeamName("");
      setTeamImageUrl("");
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to create team");
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    try {
      await updateEventStatus(eventId, newStatus);
      toast.success(`Event status updated to ${newStatus}`);
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete event "${title}"? All competition rankings and teams for this event will be removed.`)) {
      return;
    }
    try {
      await deleteEvent(eventId);
      toast.success('Event deleted successfully');
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event');
    }
  };

  const handleDeleteTeam = async (eventId: string, teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamName}"?`)) {
      return;
    }
    try {
      await deleteTeam(eventId, teamId);
      toast.success('Team deleted successfully');
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete team');
    }
  };

  const handleSetFeatured = async (eventId: string | null, isFeatured: boolean) => {
    try {
      await setFeaturedEvent(eventId, isFeatured);
      toast.success(isFeatured && eventId ? 'Event set as Featured on Homepage!' : 'Event removed from Homepage feature');
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update featured event');
    }
  };

  const handleSettleEvent = async (eventId: string, title: string) => {
    try {
      const res = await settleEventRewards(eventId);
      if (res.settled) {
        toast.success(`Rewards settled! 🏆 Winner: "${res.teamName}" (${res.awardedCount} contributors awarded titles)`);
      } else {
        toast(res.reason || "No qualifying winners to award.", { icon: "ℹ️" });
      }
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to settle rewards");
    }
  };

  const featuredEvent = events.find(e => e.is_featured_homepage === 1);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Event & Competition Management</h1>
          <p className="text-slate-400 mt-1">Create time-bound vocabulary translation challenges, manage competing teams, and award profile titles.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-sm shadow-lg shadow-cyan-900/30 transition"
        >
          + Create New Competition
        </button>
      </div>

      {/* Homepage Feature Selection Bar */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">Homepage Hero Card:</span>
          {featuredEvent ? (
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-semibold">
                Featured: &quot;{featuredEvent.title}&quot;
              </span>
              {featuredEvent.status === 'ACTIVE' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live on Homescreen
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium" title="Only ACTIVE events are displayed on the homescreen">
                  Status: {featuredEvent.status} (Hidden until Active)
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 italic">None (No event displayed on homescreen)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {featuredEvent && (
            <button
              type="button"
              onClick={() => handleSetFeatured(null, false)}
              className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-700/60 text-red-300 rounded-lg font-semibold cursor-pointer transition flex items-center gap-1.5"
            >
              <span>🚫 Hide from Homepage</span>
            </button>
          )}
          <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700 transition">
            <input
              type="radio"
              name="featured_homepage_event"
              checked={!featuredEvent}
              onChange={() => handleSetFeatured(null, false)}
              className="accent-cyan-400 cursor-pointer"
            />
            <span className="font-semibold text-slate-300">None (Hide from Homepage)</span>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-12 text-center text-slate-400">
          No competitions created yet. Click &quot;+ Create New Competition&quot; above to launch your first event!
        </div>
      ) : (
        <div className="space-y-6">

          {events.map((evt) => {
            const current = evt.current_count || 0;
            const target = evt.target_count || 0;
            const isHighestMode = target === 0;
            const pct = isHighestMode ? 100 : Math.min(100, Math.round((current / target) * 100));

            return (
              <div key={evt.id} className="bg-slate-800/90 border border-slate-700 rounded-xl p-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{evt.title}</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        evt.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        evt.status === 'UPCOMING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {evt.status}
                      </span>
                      {evt.has_teams === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          👤 Individual Challenge
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 mt-1">{evt.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {evt.is_featured_homepage === 1 ? (
                      <button
                        type="button"
                        onClick={() => handleSetFeatured(null, false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/80 border border-cyan-500/80 hover:bg-red-950/60 hover:border-red-500/80 hover:text-red-300 rounded-lg text-xs font-semibold text-cyan-300 transition group"
                        title="Click to hide from homepage"
                      >
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse group-hover:hidden" />
                        <span className="hidden group-hover:inline text-red-400">&times;</span>
                        <span className="group-hover:hidden">Featured on Homepage</span>
                        <span className="hidden group-hover:inline">Hide from Homepage</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetFeatured(evt.id, true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-500/60 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 hover:text-cyan-300 transition"
                      >
                        Feature on Homepage
                      </button>
                    )}
                    <select
                      value={evt.status}
                      onChange={(e) => handleStatusChange(evt.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="UPCOMING">Set UPCOMING</option>
                      <option value="ACTIVE">Set ACTIVE</option>
                      <option value="ENDED">Set ENDED</option>
                      <option value="CANCELLED">Set CANCELLED</option>
                    </select>

                    <button
                      onClick={() => handleSettleEvent(evt.id, evt.title)}
                      className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                      title="Settle competition and award winner titles to #1 team"
                    >
                      <Trophy size={13} />
                      Settle Titles
                    </button>

                    <button
                      onClick={() => setActiveQr({ eventId: evt.id })}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg"
                    >
                      Event QR
                    </button>
                    {evt.has_teams !== 0 && (
                      <button
                        onClick={() => setTeamModalEventId(evt.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                      >
                        + Add Team
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(evt.id, evt.title)}
                      className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                      title="Delete Event"
                    >
                      <Trash2 size={13} />
                      Delete Event
                    </button>
                  </div>
                </div>

                {/* Progress / Mode Banner */}
                <div className="mb-4 bg-slate-900/90 p-4 rounded-xl border border-slate-700/60">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-300">
                      {isHighestMode ? "Goal Mode: Highest Translations Wins (Team with most points wins)" : "Goal Milestone Progress"}
                    </span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {isHighestMode ? `${current} Total Contributions` : `${current} / ${target} (${pct}%)`}
                    </span>
                  </div>
                  {!isHighestMode && (
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Event Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs bg-slate-900/60 p-3 rounded-lg text-slate-300 mb-4">
                  <div>
                    <span className="text-slate-500 block">Start Date:</span>
                    <span className="font-mono text-slate-200">{new Date(evt.start_date).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">End Date:</span>
                    <span className="font-mono text-slate-200">{new Date(evt.end_date).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Target Vocabulary:</span>
                    <span className="font-semibold text-cyan-400">{evt.source_name || "ALL Vocabularies"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Winner Prize Title:</span>
                    <span className="font-semibold text-amber-300">{evt.reward_title ? `🏆 ${evt.reward_title}` : "None"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Target Language / Teams:</span>
                    <span className="font-semibold text-slate-200">
                      {evt.target_language?.toUpperCase() || "ALL"} • {evt.has_teams === 0 ? "👤 Individual Challenge" : `${evt.teams?.length || 0} teams`}
                    </span>
                  </div>
                </div>

                {/* Teams List */}
                {evt.has_teams === 0 ? (
                  <p className="text-xs text-slate-400 italic">👤 Individual Challenge — participants contribute directly without teams.</p>
                ) : evt.teams && evt.teams.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {evt.teams.map((t) => (
                      <div key={t.id} className="bg-slate-900/80 border border-slate-700/60 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-white text-sm">{t.name}</h4>
                          <p className="text-xs text-slate-400 font-mono">Code: {t.join_code} • {t.total_points || 0} pts</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setActiveQr({ eventId: evt.id, joinCode: t.join_code })}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs rounded border border-slate-700"
                          >
                            Team QR
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(evt.id, t.id, t.name)}
                            className="p-1 bg-red-950/60 hover:bg-red-900 text-red-400 hover:text-red-200 text-xs rounded border border-red-800/60 transition"
                            title="Delete Team"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No teams created for this competition yet.</p>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Create Competition Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Create Vocabulary Competition</h3>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Competition Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. SeaDataNet Parameter Translation Hackathon"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Event goals, rules, and participant instructions..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date *</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Date *</label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Competition Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHasTeams(true)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      hasTeams ? "bg-cyan-600/30 border-cyan-500 text-cyan-300" : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    👥 Team Competition
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasTeams(false)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      !hasTeams ? "bg-cyan-600/30 border-cyan-500 text-cyan-300" : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    👤 Individual Challenge (No Teams)
                  </button>
                </div>
                {!hasTeams && (
                  <p className="text-[11px] text-slate-400 mt-1">Participants contribute directly as individuals. No teams are created or required.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Vocabulary Collection</label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">ALL Vocabulary Collections</option>
                  {sources.map((s) => (
                    <option key={s.source_id} value={s.source_id}>
                      {s.name} ({s.source_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Metric Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGoalMode("HIGHEST")}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      goalMode === "HIGHEST"
                        ? "bg-cyan-600/30 border-cyan-500 text-cyan-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    Highest Wins (Most Translations)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalMode("FIXED")}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      goalMode === "FIXED"
                        ? "bg-cyan-600/30 border-cyan-500 text-cyan-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    Fixed Milestone Target
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Language</label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">ALL Languages</option>
                    <option value="fr">French (fr)</option>
                    <option value="nl">Dutch (nl)</option>
                    <option value="de">German (de)</option>
                    <option value="es">Spanish (es)</option>
                    <option value="it">Italian (it)</option>
                  </select>
                </div>

                {goalMode === "FIXED" ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Goal Count (Target)</label>
                    <input
                      type="number"
                      min={1}
                      value={targetCount}
                      onChange={(e) => setTargetCount(parseInt(e.target.value, 10) || 100)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                ) : (
                  <div className="flex items-center text-xs text-cyan-400 font-semibold pt-4">
                    🏆 Highest translations count wins
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Winner Profile Title Reward</label>
                <input
                  type="text"
                  value={rewardTitle}
                  onChange={(e) => setRewardTitle(e.target.value)}
                  placeholder="e.g. SeaDataNet Vocab Master 2026"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold"
                >
                  Create Competition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {teamModalEventId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Add Team to Competition</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Team Coral"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Image URL (Optional)</label>
                <input
                  type="text"
                  value={teamImageUrl}
                  onChange={(e) => setTeamImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTeamModalEventId(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Viewer */}
      {activeQr && (
        <QRCodeModal
          eventId={activeQr.eventId}
          joinCode={activeQr.joinCode}
          onClose={() => setActiveQr(null)}
        />
      )}
    </div>
  );
};

export default AdminEvents;
