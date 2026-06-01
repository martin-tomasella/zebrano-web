
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';

const EC = { activo:'#4ade80', en_pausa:'#fbbf24', entregado:'#60a5fa', cancelado:'#f87171' };

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('proyectos').select('*, clientes(nombre,apellido)').order('created_at',{ascending:false});
      setProyectos(data||[]); setLoading(false);
    };
    load();
  }, []);

  return (
    <Layout>
      <Topbar title="Proyectos" subtitle={`${proyectos.length} en total`} />
      <PageContent>
        {loading ? (
          <div style={{textAlign:'center',padding:48,color:'var(--z-text-muted)'}}>Cargando...</div>
        ) : proyectos.length === 0 ? (
          <div style={{textAlign:'center',padding:64,border:'1px dashed var(--z-border)',borderRadius:'var(--z-radius-xl)',color:'var(--z-text-muted)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div><p>Sin proyectos registrados</p>
          </div>
        ) : (
          <div style={{background:'var(--z-card)',border:'1px solid var(--z-border)',borderRadius:'var(--z-radius-lg)',overflow:'hidden'}}>
            <table>
              <thead><tr>{['Proyecto','Cliente','Tipo','Estado','Entrega','Presupuesto'].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {proyectos.map(p => (
                  <tr key={p.id}>
                    <td style={{fontWeight:500}}>{p.nombre||p.descripcion||'Sin nombre'}</td>
                    <td style={{color:'var(--z-text-2)'}}>{p.clientes?.nombre||'—'} {p.clientes?.apellido||''}</td>
                    <td style={{color:'var(--z-text-3)',textTransform:'capitalize'}}>{p.tipo_trabajo||'—'}</td>
                    <td><span className="badge" style={{background:(EC[p.estado]||'#6b7280')+'18',color:EC[p.estado]||'#6b7280',border:`1px solid ${(EC[p.estado]||'#6b7280')}33`,textTransform:'capitalize'}}>{p.estado||'—'}</span></td>
                    <td style={{fontSize:12,color:'var(--z-text-2)'}}>{p.fecha_entrega_estimada?new Date(p.fecha_entrega_estimada).toLocaleDateString('es-AR'):'—'}</td>
                    <td style={{color:'var(--z-success)'}}>{p.presupuesto_final?`$${p.presupuesto_final.toLocaleString('es-AR')}`:p.presupuesto_estimado?`$${p.presupuesto_estimado.toLocaleString('es-AR')}`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>
    </Layout>
  );
}
