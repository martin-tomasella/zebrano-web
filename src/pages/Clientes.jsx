
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('clientes').select('*').order('created_at',{ascending:false});
      setClientes(data||[]); setLoading(false);
    };
    load();
  }, []);

  const filtrados = clientes.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (c.nombre||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.telefono||'').includes(q);
  });

  return (
    <Layout>
      <Topbar title="Clientes" subtitle={`${clientes.length} registrados`}
        actions={<input placeholder="Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{width:200,padding:'6px 12px',fontSize:12,background:'var(--z-card)',border:'1px solid var(--z-border)',borderRadius:8,color:'var(--z-text)',outline:'none'}} />}
      />
      <PageContent>
        {loading ? (
          <div style={{textAlign:'center',padding:48,color:'var(--z-text-muted)'}}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{textAlign:'center',padding:64,border:'1px dashed var(--z-border)',borderRadius:'var(--z-radius-xl)',color:'var(--z-text-muted)'}}>
            <div style={{fontSize:40,marginBottom:12}}>👤</div>
            <p>Sin clientes registrados</p>
          </div>
        ) : (
          <div style={{background:'var(--z-card)',border:'1px solid var(--z-border)',borderRadius:'var(--z-radius-lg)',overflow:'hidden'}}>
            <table>
              <thead><tr>{['Nombre','Email','Teléfono','Localidad','Creado'].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td style={{fontWeight:500}}>{c.nombre||'—'} {c.apellido||''}</td>
                    <td style={{color:'var(--z-text-2)'}}>{c.email||'—'}</td>
                    <td style={{color:'var(--z-text-2)'}}>{c.telefono||'—'}</td>
                    <td style={{color:'var(--z-text-3)'}}>{c.localidad||'—'}</td>
                    <td style={{fontSize:11,color:'var(--z-text-muted)'}}>{c.created_at?new Date(c.created_at).toLocaleDateString('es-AR'):'—'}</td>
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
