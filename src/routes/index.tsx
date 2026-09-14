import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { claimGift, listGifts, type Gift } from "@/lib/gifts.functions";

export const Route = createFileRoute("/")({ component: Home });
const colorless = /copo|jarra|vidro|transparente|cristal/i;

function Home() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selected, setSelected] = useState<Gift | null>(null);
  const [notice, setNotice] = useState("");
  const gifts = useQuery({ queryKey: ["gifts"], queryFn: () => listGifts(), refetchInterval: 20000 });
  const claim = useMutation({
    mutationFn: (id: string) => claimGift({ data: { id } }),
    onSuccess: async (result) => {
      if (result.ok) {
        setNotice("Presente reservado! Muito obrigada pelo carinho. Este item já saiu da lista.");
        setSelected(null);
        await queryClient.invalidateQueries({ queryKey: ["gifts"] });
      } else setNotice(result.reason);
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Não foi possível reservar."),
  });
  const rows = gifts.data ?? [];
  const categories = useMemo(() => ["Todos", ...Array.from(new Set(rows.map((g) => g.category)))], [rows]);
  const visible = useMemo(() => rows.filter((gift) => {
    const q = search.trim().toLowerCase();
    return (category === "Todos" || gift.category === category) && (!q || gift.name.toLowerCase().includes(q));
  }), [rows, search, category]);
  const available = rows.filter((gift) => !gift.claimed_at && gift.stock > 0).length;

  return <div className="site-shell">
    <header className="hero"><div className="hero-deco hero-deco-a"/><div className="hero-deco hero-deco-b"/><nav className="nav"><span className="brand">M &amp; C</span><a href="#lista">Lista de presentes</a></nav><div className="hero-content"><p className="eyebrow">CHÁ DE PANELA</p><h1>Nossa casa começa <em>com você por perto.</em></h1><p className="hero-copy">Estamos começando uma nova fase juntos e preparando nosso cantinho com muito amor. Se quiser fazer parte desse sonho, escolha um presentinho da nossa lista. Agradecemos de coração por todo carinho e por celebrar esse momento tão especial conosco!</p><div className="hero-actions"><a className="primary-btn" href="#lista">Ver a lista</a><span>{available} de {rows.length || 50} presentes disponíveis</span></div></div></header>
    <main id="lista" className="content"><div className="section-head"><div><p className="eyebrow">UM CARINHO PARA NOSSA CASA</p><h2>Lista de presentes</h2><p>Toque em “Quero presentear” e confirme. Você não precisa se identificar.</p></div><div className="count-badge">{available} disponíveis</div></div><div className="toolbar"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar presente..." aria-label="Buscar presente"/></div><div className="chips">{categories.map((item)=><button key={item} className={item===category?"chip active":"chip"} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    {notice&&<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice("")}>Fechar</button></div>}{gifts.isLoading&&<div className="loading">Carregando a lista...</div>}{gifts.isError&&<div className="error-box">Não conseguimos carregar a lista agora. Tente atualizar a página.</div>}
    <div className="grid">{visible.map((gift)=>{const chosen=!!gift.claimed_at||gift.stock<=0;return <article key={gift.id} className={chosen?"gift-card chosen":"gift-card"}><div className="gift-image">{gift.image_url?<img src={gift.image_url} alt={gift.name} loading="lazy"/>:<div className="placeholder"><span>♡</span><small>presente especial</small></div>}{chosen&&<span className="chosen-badge">Escolhido</span>}</div><div className="gift-body"><p className="gift-category">{gift.category}</p><h3>{gift.name}</h3>{gift.description&&<p className="gift-description">{gift.description}</p>}{!colorless.test(`${gift.name} ${gift.category}`)&&<div className="colors"><span className="dot white"/><span className="dot black"/><span className="dot steel"/><span className="dot bamboo"/><small>cores sugeridas</small></div>}<button disabled={chosen} className="gift-btn" onClick={()=>setSelected(gift)}>{chosen?"Já escolhido":"Quero presentear"}</button></div></article>})}</div>{!gifts.isLoading&&visible.length===0&&<div className="empty">Nenhum presente encontrado.</div>}</main>
    <footer><p>Com carinho, obrigada por fazer parte deste começo.</p><Link to="/admin">Painel</Link></footer>
    {selected&&<div className="modal-backdrop" onMouseDown={()=>!claim.isPending&&setSelected(null)}><div className="modal" onMouseDown={(e)=>e.stopPropagation()}><p className="eyebrow">CONFIRMAR ESCOLHA</p><h2>{selected.name}</h2><p>Tem certeza que deseja escolher este presente? Depois da confirmação ele ficará indisponível para as outras pessoas.</p>{selected.image_url&&<img src={selected.image_url} alt={selected.name}/>}<div className="modal-actions"><button className="secondary-btn" disabled={claim.isPending} onClick={()=>setSelected(null)}>Cancelar</button><button className="primary-btn" disabled={claim.isPending} onClick={()=>claim.mutate(selected.id)}>{claim.isPending?"Confirmando...":"Sim, quero este"}</button></div></div></div>}
  </div>;
}
