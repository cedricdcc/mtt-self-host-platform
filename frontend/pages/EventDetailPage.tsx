import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchEventDetails, joinEventTeam, deleteEvent, deleteTeam, fetchEventStats } from "../services/eventApi";
import { Event, EventStatsResponse } from "../types";
import { QRCodeModal } from "../components/QRCodeModal";
import { EventActivityChart } from "../components/EventActivityChart";
import { EventIndividualLeaderboard } from "../components/EventIndividualLeaderboard";
import { useAuth } from "../context/AuthContext";
import { Trash2, Trophy, Users, Zap, QrCode, Activity } from "lucide-react";
import toast from "react-hot-toast";

import { getPreferredNonEnglishLanguage } from "../utils/userLanguage";

export const EventDetailPage: React.FC<{ eventId?: string }> = ({ eventId: propEventId }) => {

  const { id: paramEventId } = useParams<{ id: string }>();
  const activeEventId = propEventId || paramEventId;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [activeJoinCode, setActiveJoinCode] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [eventStats, setEventStats] = useState<EventStatsResponse | null>(null);
  const [userOnly, setUserOnly] = useState<boolean>(false);
  const [chartResolution, setChartResolution] = useState<string>('smart');

  const loadStats = () => {
    if (!activeEventId) return;
    fetchEventStats(activeEventId, chartResolution, userOnly)
      .then(setEventStats)
      .catch((err) => console.error("Failed to load event stats:", err));
  };

  const loadEvent = () => {
    if (!activeEventId) return;
    setLoading(true);
    fetchEventDetails(activeEventId)
      .then(setEvent)
      .catch((err) => toast.error(err.message || "Failed to load competition details"))
      .finally(() => setLoading(false));
    loadStats();
  };

  useEffect(() => {
    loadStats();
  }, [activeEventId, chartResolution, userOnly]);

  useEffect(() => {
    loadEvent();
    const params = new URLSearchParams(window.location.search);
    const urlTeamId = params.get("joinTeamId") || params.get("teamId");
    const urlJoinCode = params.get("joinCode");
    
    if (urlTeamId) {
      setTargetTeamId(urlTeamId);
    } else if (urlJoinCode && event?.teams) {
      const match = event.teams.find(t => t.join_code === urlJoinCode);
      if (match) setTargetTeamId(match.id);
    }
  }, [activeEventId]);

  useEffect(() => {
    if (targetTeamId && event?.teams) {
      const match = event.teams.find(t => t.id === targetTeamId || t.join_code === targetTeamId);
      if (match) {
        setTargetTeamId(match.id);
        setTimeout(() => {
          const el = document.getElementById(`team-card-${match.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 300);
      }
    }
  }, [targetTeamId, event]);

  const handleJoinTeamDirect = async (code: string) => {
    if (!activeEventId) return;
    if (!user) {
      sessionStorage.setItem("pending_event_join", JSON.stringify({
        eventId: activeEventId,
        joinCode: code
      }));
      toast("Please sign in to join this team. Redirecting...", { icon: "🔐" });
      navigate("/login");
      return;
    }

    setJoining(true);
    try {
      await joinEventTeam(activeEventId, code);
      toast.success("Successfully joined team! 🎉");
      loadEvent();
    } catch (err: any) {
      toast.error(err.message || "Failed to join team.");
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event || !confirm(`Are you sure you want to delete event "${event.title}"? All competition rankings for this event will be removed.`)) {
      return;
    }
    try {
      await deleteEvent(event.id);
      toast.success('Event deleted successfully');
      navigate('/events');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event');
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!event || !confirm(`Are you sure you want to delete team "${teamName}"?`)) {
      return;
    }
    try {
      await deleteTeam(event.id, teamId);
      toast.success('Team deleted successfully');
      loadEvent();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete team');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-600 dark:text-slate-300 font-medium">Loading competition details...</div>;
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Event Not Found</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">The requested competition event does not exist or has been removed.</p>
          <Link to="/events" className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold shadow transition">
            &larr; Back to Events Hub
          </Link>
        </div>
      </div>
    );
  }

  const current = event.current_count || 0;
  const target = event.target_count || 0;
  const isHighestMode = target === 0;
  const pct = isHighestMode ? 100 : Math.min(100, Math.round((current / target) * 100));
  const isUserMember = !!(event?.user_team_id || event?.teams?.some(t => t.is_user_member));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back Button & Header */}
      <div className="mb-6">
        <Link to="/events" className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition flex items-center gap-1 mb-3">
          &larr; Back to Events Hub
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{event.title}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                event.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30' :
                event.status === 'UPCOMING' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30' :
                'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {event.status}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm max-w-2xl">{event.description}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {user && (
              <Link
                to={`/flow?source=${event.source_id || ''}&language=${getPreferredNonEnglishLanguage(user, event.target_language)}`}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition transform hover:-translate-y-0.5"
              >
                <Zap size={16} /> Start Competition Flow &rarr;
              </Link>
            )}


            <button
              onClick={() => setShowQR(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl font-semibold text-sm flex items-center gap-2 border border-slate-200 dark:border-slate-600 transition"
            >
              <QrCode size={16} /> QR Code
            </button>
            {(user?.isAdmin || user?.isSuperAdmin) && (
              <button
                onClick={handleDeleteEvent}
                className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
              >
                <Trash2 size={16} /> Delete Event
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress & Competition Scope Card */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-8 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-xs">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Target Vocabulary</span>
            <span className="text-base font-bold text-cyan-600 dark:text-cyan-400">{event.source_name || "ALL Vocabularies"}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Target Language / Scope</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-200">{event.target_language?.toUpperCase() || "ALL"}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 block mb-1 font-medium">Competition Timeline</span>
            <span className="text-xs font-mono text-slate-800 dark:text-slate-200 block font-semibold">{new Date(event.start_date).toLocaleDateString()} – {new Date(event.end_date).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Goal Metric Bar */}
        <div className="bg-slate-50 dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {isHighestMode ? "Goal Mode: Highest Translations Wins (Open Competitive Challenge)" : "Event Milestone Progress"}
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              {isHighestMode ? `${current} Total Contributions` : `${current} / ${target} translations (${pct}%)`}
            </span>
          </div>
          {!isHighestMode && (
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-300 dark:border-slate-700">
              <div
                className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-500 shadow"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Competition Reward & Title Showcase */}
      {event.reward_title && (
        <div className="bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-cyan-500/10 border-2 border-amber-400/40 rounded-2xl p-6 mb-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 border border-amber-400/50 rounded-xl text-amber-400 flex-shrink-0">
                <Trophy size={28} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                  Grand Prize Profile Title
                </span>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  &quot;{event.reward_title}&quot;
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {event.status === 'ENDED'
                    ? (event.has_teams === 0
                        ? "🏆 Competition concluded! The 1st place contributor has received this exclusive title on their profile."
                        : "🏆 Competition concluded! Members of the 1st place team with active translation contributions have received this exclusive title on their profile.")
                    : (event.has_teams === 0
                        ? "The 1st place contributor will unlock this exclusive title on their profile."
                        : "Members of the 1st place team with active translation contributions will unlock this exclusive title on their profile.")
                  }
                </p>
              </div>
            </div>
            {event.status === 'ENDED' && (
              event.has_teams === 0 ? (
                eventStats?.individualLeaderboard && eventStats.individualLeaderboard.length > 0 && (eventStats.individualLeaderboard[0].totalPoints || 0) > 0 && (
                  <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 self-start sm:self-center">
                    <span>🥇 Winner: {eventStats.individualLeaderboard[0].name} ({eventStats.individualLeaderboard[0].totalPoints} pts)</span>
                  </div>
                )
              ) : (
                event.teams && event.teams.length > 0 && (event.teams[0].total_points || 0) > 0 && (
                  <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 self-start sm:self-center">
                    <span>🥇 Winner: {event.teams[0].name} ({event.teams[0].total_points} pts)</span>
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}

      {/* Event Activity & Performance */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-500" /> Event Activity &amp; Performance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time submission throughput and participation dynamics.
            </p>
          </div>

          {/* Scope Toggle: All Event Activity vs My Contributions */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            <button
              onClick={() => setUserOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                !userOnly
                  ? 'bg-white dark:bg-cyan-600 text-cyan-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Event Activity
            </button>
            <button
              onClick={() => {
                if (!user) {
                  toast('Please log in to view personal contributions', { icon: '🔐' });
                  return;
                }
                setUserOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                userOnly
                  ? 'bg-white dark:bg-cyan-600 text-cyan-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              My Contributions
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-medium">In Review</span>
              <span className="text-amber-500 font-bold">📝</span>
            </div>
            <div className="text-2xl font-extrabold text-amber-500 dark:text-amber-400 font-mono">
              {eventStats?.stats?.inReviewCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Pending review
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-medium">Approved</span>
              <span className="text-emerald-500 font-bold">✅</span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-500 dark:text-emerald-400 font-mono">
              {eventStats?.stats?.approvedCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Verified submissions
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-medium">Total Points</span>
              <Zap className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
              {eventStats?.stats?.totalPoints ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {eventStats?.stats?.totalActions ?? 0} total actions
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-medium">Contributors</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-500 dark:text-indigo-400 font-mono">
              {eventStats?.stats?.activeContributors ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Active participants
            </div>
          </div>
        </div>

        {/* Activity Chart */}
        <EventActivityChart
          data={eventStats?.timeline?.data || []}
          resolution={eventStats?.timeline?.resolution || 'day'}
          selectedResolution={chartResolution}
          onResolutionChange={setChartResolution}
        />
      </div>

      {/* Leaderboard Podium */}
      {event.has_teams === 0 ? (
        <EventIndividualLeaderboard
          contributors={eventStats?.individualLeaderboard || []}
          currentUserId={user?.id}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" /> Team Leaderboard
            </h2>
          </div>

          {event.teams && event.teams.length > 0 ? (
            <div className="space-y-6">
              {/* Top 3 Podium Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                {event.teams.slice(0, 3).map((team, idx) => {
                  const isTarget = targetTeamId === team.id;
                  const isMyTeam = team.is_user_member || event.user_team_id === team.id;
                  return (
                    <div
                      key={team.id}
                      id={`team-card-${team.id}`}
                      className={`bg-white dark:bg-slate-800/90 border rounded-2xl p-6 shadow-lg relative overflow-hidden transition-all duration-500 ${
                        isMyTeam ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40" :
                        isTarget ? "ring-4 ring-cyan-500 border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/60 shadow-[0_0_25px_rgba(6,182,212,0.4)] scale-[1.02]" :
                        idx === 0 ? "border-amber-400 dark:border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent" :
                        idx === 1 ? "border-slate-300 dark:border-slate-500/50 bg-gradient-to-b from-slate-400/10 via-slate-400/5 to-transparent" :
                        "border-amber-700/40 dark:border-amber-700/50 bg-gradient-to-b from-amber-700/10 via-amber-700/5 to-transparent"
                      }`}
                    >
                      {isMyTeam ? (
                        <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-emerald-500 text-white font-bold text-[10px] uppercase rounded-full shadow-sm">
                          ✓ Your Team
                        </div>
                      ) : isTarget ? (
                        <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-cyan-500 text-slate-950 font-bold text-[10px] uppercase rounded-full animate-bounce shadow-sm">
                          Selected via QR
                        </div>
                      ) : null}

                      <div className="text-3xl mb-2">{idx === 0 ? "🥇 1st Place" : idx === 1 ? "🥈 2nd Place" : "🥉 3rd Place"}</div>
                      <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-1">{team.name}</h3>
                      <p className="text-cyan-600 dark:text-cyan-400 font-mono font-extrabold text-xl">{team.total_points || 0} pts</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 flex items-center justify-center gap-1">
                        <Users size={12} /> {team.member_count || 0} members • Code: {team.join_code}
                      </p>
                      
                      <div className="flex items-center justify-center gap-2">
                        {!isMyTeam && (
                          <button
                            onClick={() => handleJoinTeamDirect(team.join_code)}
                            disabled={joining}
                            className={`px-4 py-2 font-bold text-xs rounded-xl shadow transition ${
                              isTarget ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                            }`}
                          >
                            Join {team.name} &rarr;
                          </button>
                        )}

                        <button
                          onClick={() => setActiveJoinCode(team.join_code)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 transition"
                        >
                          Show QR
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Remaining Teams List (4th Place Onwards) */}
              {event.teams.length > 3 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Other Competing Teams</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {event.teams.slice(3).map((team, idx) => {
                      const isTarget = targetTeamId === team.id;
                      const isMyTeam = team.is_user_member || event.user_team_id === team.id;
                      return (
                        <div
                          key={team.id}
                          id={`team-card-${team.id}`}
                          className={`bg-white dark:bg-slate-800/90 border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition ${
                            isMyTeam ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30" :
                            isTarget ? "ring-2 ring-cyan-500 border-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/30" :
                            "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-400 dark:text-slate-500 text-sm">#{idx + 4}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{team.name}</h4>
                                {isMyTeam && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold rounded">Your Team</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{team.member_count || 0} members • Code: {team.join_code}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">{team.total_points || 0} pts</span>
                            {!isMyTeam && (
                              <button
                                onClick={() => handleJoinTeamDirect(team.join_code)}
                                disabled={joining}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow transition"
                              >
                                Join &rarr;
                              </button>
                            )}
                            <button
                              onClick={() => setActiveJoinCode(team.join_code)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 transition"
                            >
                              QR
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm">
              No competing teams created for this event yet.
            </div>
          )}
        </>
      )}

      {/* QR Code Viewer */}
      {(showQR || activeJoinCode) && (
        <QRCodeModal
          eventId={event.id}
          joinCode={activeJoinCode || undefined}
          onClose={() => {
            setShowQR(false);
            setActiveJoinCode(null);
          }}
        />
      )}
    </div>
  );
};

export default EventDetailPage;
