'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Check,
  X,
  Clock,
  HelpCircle,
  Phone,
  FileText,
  Trash2,
  Filter,
  Search,
  ChevronDown,
  Activity,
  UserCheck,
  UserX,
  AlertCircle,
} from 'lucide-react';

interface Patient {
  _id: string;
  cedula: string;
  phoneNumber: string;
  name?: string;
  requestedProcedure: string;
  meetsRequirements: boolean;
  requirementDetails?: string;
  status: 'pending' | 'approved' | 'denied' | 'info_needed';
  conversationSummary?: string;
  createdAt: number;
  updatedAt: number;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  infoNeeded: number;
  meetsRequirements: number;
}

const statusConfig = {
  pending: { label: 'Pendiente', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  approved: { label: 'Aprobado', icon: Check, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  denied: { label: 'Denegado', icon: X, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  info_needed: { label: 'Info Requerida', icon: HelpCircle, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const response = await fetch(`/api/patients?${params}`);
      if (!response.ok) throw new Error('Error al cargar pacientes');
      const data = await response.json();
      setPatients(data.patients || []);
      setStats(data.stats || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este paciente?')) return;
    
    try {
      const response = await fetch(`/api/patients?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al eliminar');
      fetchPatients();
      setSelectedPatient(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredPatients = patients.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.cedula.toLowerCase().includes(query) ||
      p.phoneNumber.includes(query) ||
      p.name?.toLowerCase().includes(query) ||
      p.requestedProcedure.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#f7f6f3]">
      {/* Header */}
      <header className="bg-white border-b border-[#e3e2de] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 hover:bg-[#f7f6f3] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#6b6b6b]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#0f7b6c] rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#37352f]">Pacientes</h1>
                <p className="text-sm text-[#6b6b6b]">Solicitudes de autorización via WhatsApp</p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchPatients}
            disabled={loading}
            className="px-4 py-2 bg-[#f7f6f3] hover:bg-[#efefef] border border-[#e3e2de] rounded-lg flex items-center gap-2 text-sm text-[#37352f] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 border border-[#e3e2de]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f7f6f3] rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-[#6b6b6b]" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#37352f]">{stats.total}</div>
                  <div className="text-xs text-[#6b6b6b]">Total</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                  <div className="text-xs text-[#6b6b6b]">Pendientes</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                  <div className="text-xs text-[#6b6b6b]">Aprobados</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                  <UserX className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{stats.denied}</div>
                  <div className="text-xs text-[#6b6b6b]">Denegados</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.infoNeeded}</div>
                  <div className="text-xs text-[#6b6b6b]">Info Requerida</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
            <input
              type="text"
              placeholder="Buscar por cédula, teléfono, nombre o procedimiento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e3e2de] rounded-lg text-sm focus:outline-none focus:border-[#0f7b6c]"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-10 py-2.5 bg-white border border-[#e3e2de] rounded-lg text-sm appearance-none cursor-pointer focus:outline-none focus:border-[#0f7b6c]"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobados</option>
              <option value="denied">Denegados</option>
              <option value="info_needed">Info Requerida</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b] pointer-events-none" />
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#e3e2de] overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#0f7b6c] animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-red-500">
                <X className="w-8 h-8 mb-2" />
                <p>{error}</p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#6b6b6b]">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium">No hay pacientes registrados</p>
                <p className="text-sm">Los pacientes aparecerán aquí cuando envíen mensajes por WhatsApp</p>
              </div>
            ) : (
              <div className="divide-y divide-[#e3e2de]">
                {filteredPatients.map((patient) => {
                  const statusInfo = statusConfig[patient.status];
                  const StatusIcon = statusInfo.icon;
                  const isSelected = selectedPatient?._id === patient._id;
                  
                  return (
                    <div
                      key={patient._id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#f7f6f3]' : 'hover:bg-[#fafaf9]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[#37352f]">
                              {patient.name || 'Sin nombre'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}>
                              <StatusIcon className="w-3 h-3 inline mr-1" />
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-[#6b6b6b]">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              {patient.cedula}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {patient.phoneNumber}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-[#37352f]">
                            <span className="font-medium">Procedimiento:</span> {patient.requestedProcedure}
                          </div>
                        </div>
                        <div className="text-right text-xs text-[#6b6b6b]">
                          {new Date(patient.createdAt).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Patient Detail */}
          <div className="bg-white rounded-xl border border-[#e3e2de] p-6">
            {selectedPatient ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-[#37352f]">Detalle del Paciente</h2>
                  <button
                    onClick={() => handleDelete(selectedPatient._id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar paciente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Nombre</label>
                    <p className="text-[#37352f] font-medium">{selectedPatient.name || 'No proporcionado'}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Cédula</label>
                    <p className="text-[#37352f] font-medium">{selectedPatient.cedula}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Teléfono</label>
                    <p className="text-[#37352f] font-medium">{selectedPatient.phoneNumber}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Procedimiento Solicitado</label>
                    <p className="text-[#37352f] font-medium">{selectedPatient.requestedProcedure}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Estado</label>
                    <div className="mt-1">
                      {(() => {
                        const statusInfo = statusConfig[selectedPatient.status];
                        const StatusIcon = statusInfo.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}>
                            <StatusIcon className="w-4 h-4" />
                            {statusInfo.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Cumple Requisitos</label>
                    <p className={`font-medium ${selectedPatient.meetsRequirements ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedPatient.meetsRequirements ? 'Sí' : 'No'}
                    </p>
                  </div>
                  
                  {selectedPatient.requirementDetails && (
                    <div>
                      <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Detalles de Requisitos</label>
                      <p className="text-[#37352f] text-sm">{selectedPatient.requirementDetails}</p>
                    </div>
                  )}
                  
                  {selectedPatient.conversationSummary && (
                    <div>
                      <label className="text-xs text-[#6b6b6b] uppercase tracking-wide">Resumen de Conversación</label>
                      <p className="text-[#37352f] text-sm bg-[#f7f6f3] p-3 rounded-lg">{selectedPatient.conversationSummary}</p>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-[#e3e2de]">
                    <div className="flex justify-between text-xs text-[#6b6b6b]">
                      <span>Creado: {new Date(selectedPatient.createdAt).toLocaleString('es')}</span>
                    </div>
                    <div className="text-xs text-[#6b6b6b] mt-1">
                      <span>Actualizado: {new Date(selectedPatient.updatedAt).toLocaleString('es')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-[#6b6b6b]">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Selecciona un paciente para ver detalles</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
