import React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import {
  BookOpen, ChevronDown, ChevronLeft, ChevronRight, Clock3, Globe2,
  Image as ImageIcon, LayoutDashboard, LogIn, MapPin, Menu, MoreHorizontal,
  Plus, Search, Settings, Shield, Sparkles, Trash2, Users, X, Save,
  FileText, Boxes, Zap, Link2
} from "lucide-react";

type Project = {
  id:string; title:string; slug:string; description:string; cover_url:string|null;
  category:string; status:"draft"|"published"|"archived"; word_count:number;
  target_words:number; chapter_count:number;
};
type Entity = Record<string, any>;

const modules = [
  ["overview","Overview",LayoutDashboard],
  ["chapters","Chapters",FileText],
  ["characters","Characters",Users],
  ["world","World",Globe2],
  ["timeline","Timeline",Clock3],
  ["locations","Locations",MapPin],
  ["factions","Factions",Shield],
  ["items","Items",Boxes],
  ["abilities","Magic / 天性",Zap],
  ["media","Gallery",ImageIcon],
] as const;

const tableFor:Record<string,string> = {
  chapters:"chapters", characters:"characters", world:"world_entries",
  timeline:"timeline_events", locations:"locations", factions:"factions",
  items:"items", abilities:"abilities", media:"media"
};

const titles:Record<string,string> = Object.fromEntries(modules.map(([k,v])=>[k,v]));

function App(){
  const [session,setSession] = useState<any>(null);
  const [loading,setLoading] = useState(true);
  const [projects,setProjects] = useState<Project[]>([]);
  const [project,setProject] = useState<Project|null>(null);
  const [module,setModule] = useState("overview");
  const [entities,setEntities] = useState<Entity[]>([]);
  const [selected,setSelected] = useState<Entity|null>(null);
  const [query,setQuery] = useState("");
  const [sidebar,setSidebar] = useState(true);
  const [authOpen,setAuthOpen] = useState(false);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [authMsg,setAuthMsg] = useState("");

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);});
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{ if(session) loadProjects(); else {setProjects([]);setProject(null);} },[session]);

  async function loadProjects(){
    const {data,error}=await supabase.from("projects").select("*").order("updated_at",{ascending:false});
    if(!error){
      setProjects(data||[]);
      if(!project && data?.length) setProject(data[0]);
    }
  }

  useEffect(()=>{ if(project && module!=="overview") loadEntities(); else {setEntities([]);setSelected(null);} },[project?.id,module]);

  async function loadEntities(){
    if(!project) return;
    const table=tableFor[module];
    const {data}=await supabase.from(table).select("*").eq("project_id",project.id).order("sort_order",{ascending:true}).order("created_at",{ascending:true});
    setEntities(data||[]);
    setSelected((data||[])[0]||null);
  }

  async function createProject(){
    if(!session) return setAuthOpen(true);
    const base="new-project";
    const {data,error}=await supabase.from("projects").insert({
      owner_id:session.user.id,title:"Untitled Story",slug:base+"-"+Date.now(),
      description:"Start building your world.",category:"Novel"
    }).select().single();
    if(error) return alert(error.message);
    setProjects(p=>[data,...p]); setProject(data); setModule("overview");
  }

  async function saveEntity(){
    if(!project || !selected) return;
    const table=tableFor[module];
    const payload={...selected};
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const {data,error}=await supabase.from(table).update(payload).eq("id",selected.id).select().single();
    if(error) return alert(error.message);
    setEntities(es=>es.map(e=>e.id===data.id?data:e)); setSelected(data);
  }

  async function addEntity(){
    if(!project) return;
    const table=tableFor[module];
    const defaults:any = {
      project_id:project.id, sort_order:entities.length
    };
    if(module==="chapters") Object.assign(defaults,{title:`Chapter ${entities.length+1}`,content:"",summary:"",chapter_number:entities.length+1});
    if(module==="characters") Object.assign(defaults,{name:"New Character",role:"",age:"",identity:"",description:""});
    if(module==="world") Object.assign(defaults,{name:"New World Entry",entry_type:"Lore",description:""});
    if(module==="timeline") Object.assign(defaults,{title:"New Event",event_date:"",era:"",description:"",importance:"normal"});
    if(module==="locations") Object.assign(defaults,{name:"New Location",description:"",region:""});
    if(module==="factions") Object.assign(defaults,{name:"New Faction",description:"",ideology:""});
    if(module==="items") Object.assign(defaults,{name:"New Item",item_type:"",description:""});
    if(module==="abilities") Object.assign(defaults,{name:"New Ability",ability_type:"Ability",description:"",cost:""});
    if(module==="media") Object.assign(defaults,{name:"New Media",file_url:"",media_type:"image"});
    const {data,error}=await supabase.from(table).insert(defaults).select().single();
    if(error) return alert(error.message);
    setEntities(e=>[...e,data]);setSelected(data);
  }

  async function deleteEntity(){
    if(!selected || !confirm("Delete this item?")) return;
    const table=tableFor[module];
    const {error}=await supabase.from(table).delete().eq("id",selected.id);
    if(error) return alert(error.message);
    const next=entities.filter(e=>e.id!==selected.id);setEntities(next);setSelected(next[0]||null);
  }

  async function signIn(){
    setAuthMsg("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error) setAuthMsg(error.message); else setAuthOpen(false);
  }
  async function signUp(){
    setAuthMsg("");
    const {error}=await supabase.auth.signUp({email,password});
    setAuthMsg(error ? error.message : "Account created. Check your email if confirmation is enabled.");
  }

  const filtered=useMemo(()=>entities.filter(e=>JSON.stringify(e).toLowerCase().includes(query.toLowerCase())),[entities,query]);

  if(loading) return <div className="boot">Loading Studio…</div>;

  return <div className="app">
    <aside className={"sidebar "+(!sidebar?"collapsed":"")}>
      <div className="brand"><span className="brandMark">F</span>{sidebar&&<div><b>FABULA</b><small>STORY STUDIO</small></div>}</div>
      <div className="sideTop">
        <button className="sideBtn" onClick={()=>setModule("overview")}><BookOpen size={17}/>{sidebar&&"Home"}</button>
        <button className="sideBtn" onClick={()=>setModule("overview")}><LayoutDashboard size={17}/>{sidebar&&"My Works"}</button>
      </div>
      {sidebar&&<div className="sectionLabel">CURRENT WORK</div>}
      {project && <div className="projectPicker">
        <div className="projectCover">{project.cover_url?<img src={project.cover_url}/>:<Sparkles size={20}/>}</div>
        {sidebar&&<div className="projectName"><b>{project.title}</b><span>{project.category}</span></div>}
        {sidebar&&<ChevronDown size={15}/>}
      </div>}
      <nav>
        {modules.map(([key,label,Icon])=><button key={key} className={"navItem "+(module===key?"active":"")} onClick={()=>setModule(key)}>
          <Icon size={17}/>{sidebar&&label}
        </button>)}
      </nav>
      <div className="sidebarBottom">
        <button className="navItem"><Settings size={17}/>{sidebar&&"Settings"}</button>
        <button className="navItem" onClick={()=>session?supabase.auth.signOut():setAuthOpen(true)}>{session?<LogIn size={17}/>:<LogIn size={17}/>} {sidebar&&(session?"Sign out":"Sign in")}</button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="topLeft"><button className="iconBtn" onClick={()=>setSidebar(!sidebar)}><Menu size={18}/></button>
          <span className="crumb">My Works</span><ChevronRight size={14}/><b>{project?.title||"No project"}</b>
        </div>
        <div className="topActions">
          <div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search anything…"/><kbd>Ctrl K</kbd></div>
          {!session?<button className="outlineBtn" onClick={()=>setAuthOpen(true)}>Sign in</button>:<span className="userDot">{session.user.email?.[0]?.toUpperCase()}</span>}
          <button className="iconBtn"><MoreHorizontal size={18}/></button>
        </div>
      </header>

      <div className="workspace">
        <div className="workspaceHeader">
          <div><div className="eyebrow">{module==="overview"?"PROJECT":titles[module]?.toUpperCase()}</div><h1>{module==="overview"?project?.title||"My Works":titles[module]}</h1></div>
          <div className="headerBtns">{module==="overview"?<button className="primaryBtn" onClick={createProject}><Plus size={16}/> New project</button>:<button className="primaryBtn" onClick={addEntity}><Plus size={16}/> New</button>}</div>
        </div>

        {module==="overview" ? <Overview project={project} projects={projects} onProject={setProject} onNew={createProject}/> :
        <div className="editorGrid">
          <section className="listPanel">
            <div className="listHeader"><b>{titles[module]}</b><span>{filtered.length}</span></div>
            <div className="listScroll">{filtered.map(e=><button key={e.id} className={"listRow "+(selected?.id===e.id?"selected":"")} onClick={()=>setSelected(e)}>
              <div className="rowIcon">{module==="characters"?<Users size={16}/>:module==="timeline"?<Clock3 size={16}/>:<FileText size={16}/>}</div>
              <div><b>{e.name||e.title}</b><small>{e.role||e.entry_type||e.event_date||e.summary||"No description"}</small></div>
            </button>)}</div>
          </section>
          <section className="detailPanel">
            {selected?<EntityEditor entity={selected} module={module} onChange={setSelected} onSave={saveEntity} onDelete={deleteEntity}/>:
            <div className="empty"><Sparkles size={28}/><h3>Nothing here yet</h3><p>Create your first {titles[module]?.toLowerCase()}.</p><button className="primaryBtn" onClick={addEntity}><Plus size={16}/> Create</button></div>}
          </section>
        </div>}
      </div>
    </main>

    {authOpen&&<div className="modalBackdrop"><div className="authModal"><button className="close" onClick={()=>setAuthOpen(false)}><X/></button><div className="authLogo">F</div><h2>Enter your Studio</h2><p>Sign in to edit your worlds, characters and stories.</p>
      <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
      {authMsg&&<div className="authMsg">{authMsg}</div>}<button className="primaryBtn full" onClick={signIn}>Sign in</button><button className="ghostBtn full" onClick={signUp}>Create account</button>
    </div></div>}
  </div>
}

function Overview({project,projects,onProject,onNew}:any){
  if(!project) return <div className="emptyPage"><Sparkles size={34}/><h2>Build your first story</h2><p>Create a project and manage everything from one desktop workspace.</p><button className="primaryBtn" onClick={onNew}><Plus size={16}/> New project</button></div>;
  return <div className="overview">
    <div className="heroCard"><div className="heroImage">{project.cover_url?<img src={project.cover_url}/>:<div className="heroPlaceholder"><Sparkles size={34}/><span>Upload a cover in project settings</span></div>}</div>
      <div className="heroText"><div className="eyebrow">CURRENT PROJECT</div><h2>{project.title}</h2><p>{project.description||"Your story workspace is ready."}</p><div className="stats"><div><b>{project.word_count.toLocaleString()}</b><span>Words</span></div><div><b>{project.chapter_count}</b><span>Chapters</span></div><div><b>{project.target_words.toLocaleString()}</b><span>Target</span></div></div></div>
    </div>
    <div className="projectCards"><div className="panelCard"><div className="cardTitle">My Works <button onClick={onNew}><Plus size={15}/></button></div>{projects.map((p:Project)=><button className={"workCard "+(p.id===project.id?"active":"")} key={p.id} onClick={()=>onProject(p)}><div className="miniCover">{p.cover_url?<img src={p.cover_url}/>:<BookOpen size={18}/>}</div><div><b>{p.title}</b><small>{p.category} · {p.status}</small></div></button>)}</div>
      <div className="panelCard large"><div className="cardTitle">Creative system <Sparkles size={15}/></div><div className="systemGrid">{["Chapters","Characters","World","Timeline","Locations","Factions"].map(x=><div key={x} className="systemTile"><b>{x}</b><span>Editable from Studio</span></div>)}</div></div></div>
  </div>
}

function EntityEditor({entity,module,onChange,onSave,onDelete}:any){
  const fields = module==="chapters"
    ? [["title","Title","input"],["chapter_number","Chapter number","number"],["summary","Summary","textarea"],["content","Chapter content","editor"]]
    : module==="characters"
    ? [["name","Name","input"],["role","Role","input"],["age","Age","input"],["identity","Identity","input"],["description","Description","textarea"]]
    : module==="world"
    ? [["name","Name","input"],["entry_type","Type","input"],["description","Description","textarea"]]
    : module==="timeline"
    ? [["title","Event title","input"],["event_date","Date / era","input"],["era","Era","input"],["importance","Importance","input"],["description","Description","textarea"]]
    : module==="locations"
    ? [["name","Name","input"],["region","Region","input"],["description","Description","textarea"]]
    : module==="factions"
    ? [["name","Name","input"],["ideology","Ideology","input"],["description","Description","textarea"]]
    : module==="items"
    ? [["name","Name","input"],["item_type","Type","input"],["description","Description","textarea"]]
    : module==="abilities"
    ? [["name","Name","input"],["ability_type","Type","input"],["cost","Cost","input"],["description","Description","textarea"]]
    : [["name","Name","input"],["file_url","File URL","input"],["media_type","Media type","input"]];
  return <div className="entityEditor"><div className="detailTop"><div><div className="eyebrow">EDITING</div><h2>{entity.name||entity.title}</h2></div><div className="detailActions"><button className="iconBtn danger" onClick={onDelete}><Trash2 size={17}/></button><button className="primaryBtn" onClick={onSave}><Save size={16}/> Save</button></div></div>
    {module==="characters"&&<div className="avatarEdit">{entity.avatar_url?<img src={entity.avatar_url}/>:<Users size={28}/>}<div><b>Character portrait</b><small>Paste a Supabase Storage URL in the avatar field below.</small></div></div>}
    {fields.map(([key,label,type])=><label className="field" key={key}><span>{label}</span>{type==="textarea"||type==="editor"?<textarea className={type==="editor"?"storyEditor":""} rows={type==="editor"?18:5} value={entity[key]??""} onChange={e=>onChange({...entity,[key]:e.target.value})}/>:<input type={type==="number"?"number":"text"} value={entity[key]??""} onChange={e=>onChange({...entity,[key]:type==="number"?Number(e.target.value):e.target.value})}/>}</label>)}
    <div className="editorHint"><Link2 size={15}/> Changes are saved directly to Supabase and appear in the public site when the project/content is published.</div>
  </div>
}

export default App;
