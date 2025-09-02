const AIRIS = (() => {
  const STORAGE_KEY = "airis_gallery_v1";
  const PWD_KEY = "airis_admin_pwd";
  const DEFAULT_PWD = "prof123";

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const readStore = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { classes: {} };
      return JSON.parse(raw);
    } catch(e){
      console.error("Erro ao ler armazenamento", e);
      return { classes: {} };
    }
  };
  const writeStore = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const ensurePwd = () => {
    if (!localStorage.getItem(PWD_KEY)) {
      localStorage.setItem(PWD_KEY, DEFAULT_PWD);
    }
  };

  const fileToDataURL = (file) => new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const uid = () => Math.random().toString(36).slice(2,10);

  const initPublic = () => {
    ensurePwd();
    renderClassGrid();

    $("#search").addEventListener("input", renderClassGrid);

    $("#exportBackup").addEventListener("click", () => {
      const data = readStore();
      const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "airis-galeria-backup.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    $("#importBackup").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if(!f) return;
      try{
        const txt = await f.text();
        const json = JSON.parse(txt);
        writeStore(json);
        renderClassGrid();
        alert("Backup importado com sucesso!");
      }catch(err){
        alert("Arquivo inválido.");
      } finally {
        e.target.value = "";
      }
    });
  };

  const renderClassGrid = () => {
    const grid = $("#classGrid");
    grid.innerHTML = "";
    const data = readStore();
    const term = ($("#search").value || "").toLowerCase();

    const entries = Object.entries(data.classes);
    if(entries.length === 0){
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Sem turmas ainda. A professora pode criar turmas e enviar fotos na área administrativa.";
      grid.appendChild(empty);
      return;
    }

    entries
      .filter(([,c]) => c.name.toLowerCase().includes(term))
      .sort((a,b)=>a[1].name.localeCompare(b[1].name))
      .forEach(([id, cls]) => {
        const tpl = $("#class-card-template").content.cloneNode(true);
        $(".cover", tpl).src = cls.cover || "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' x2='1'><stop stop-color='#7a58ff'/><stop offset='.8' stop-color='#9e8cff'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' fill='white' font-family='Arial' font-size='28' text-anchor='middle'>${cls.name}</text></svg>`);
        $(".count", tpl).textContent = cls.photos.length;
        $(".class-name", tpl).textContent = cls.name;
        $(".view", tpl).addEventListener("click", () => openClassModal(id));
        grid.appendChild(tpl);
      });
  };

  const openClassModal = (classId) => {
    const data = readStore();
    const cls = data.classes[classId];
    if(!cls) return;
    $("#modalClassName").textContent = cls.name;
    const wrap = $("#photoGrid");
    wrap.innerHTML = "";

    cls.photos.forEach(ph => {
      const img = document.createElement("img");
      img.src = ph.src;
      img.alt = ph.caption || "";
      img.addEventListener("click", () => openLightbox(ph.src, ph.caption));
      wrap.appendChild(img);
    });

    const dlg = $("#classModal");
    dlg.showModal();
    $(".close-class").onclick = () => dlg.close();
  };

  const openLightbox = (src, caption="") => {
    $("#lightboxImg").src = src;
    $("#lightboxCaption").textContent = caption;
    const dlg = $("#lightbox");
    dlg.showModal();
    $(".close").onclick = () => dlg.close();
  };

  const initAdmin = () => {
    ensurePwd();
    const loginForm = $("#loginForm");
    const panel = $("#adminPanel");

    const setLogged = (state) => {
      panel.classList.toggle("hidden", !state);
    };

    const isLogged = sessionStorage.getItem("airis_logged") === "1";
    setLogged(isLogged);

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pwd = $("#pwd").value.trim();
      const saved = localStorage.getItem(PWD_KEY) || DEFAULT_PWD;
      if(pwd === saved){
        sessionStorage.setItem("airis_logged","1");
        setLogged(true);
      }else{
        alert("Senha incorreta.");
      }
      loginForm.reset();
    });

    $("#logout").addEventListener("click", () => {
      sessionStorage.removeItem("airis_logged");
      setLogged(false);
    });

    const refreshSelect = () => {
      const sel = $("#classSelect");
      sel.innerHTML = "";
      const data = readStore();
      Object.entries(data.classes).forEach(([id, c]) => {
        const opt = document.createElement("option");
        opt.value = id; opt.textContent = c.name;
        sel.appendChild(opt);
      });
    };

    const upsertClass = async (e) => {
      e.preventDefault();
      const id = $("#classId").value || uid();
      const name = $("#className").value.trim();
      const coverFile = $("#classCover").files[0];
      const data = readStore();
      if(!data.classes[id]) data.classes[id] = { name, cover:"", photos:[] };
      data.classes[id].name = name;
      if(coverFile){
        data.classes[id].cover = await fileToDataURL(coverFile);
      }
      writeStore(data);
      $("#classId").value = id;
      refreshSelect();
      alert("Turma salva!");
    };

    $("#classForm").addEventListener("submit", upsertClass);

    $("#deleteClass").addEventListener("click", () => {
      const id = $("#classId").value;
      if(!id) return alert("Selecione ou salve uma turma antes.");
      if(confirm("Tem certeza que deseja excluir esta turma e todas as fotos?")){
        const data = readStore();
        delete data.classes[id];
        writeStore(data);
        $("#classForm").reset();
        refreshSelect();
        alert("Turma excluída.");
      }
    });

    const addPhotos = async (files) => {
      const clsId = $("#classSelect").value;
      if(!clsId) return alert("Crie e selecione uma turma primeiro.");
      const data = readStore();
      const arr = data.classes[clsId].photos;
      for (const f of files){
        const src = await fileToDataURL(f);
        arr.push({ id: uid(), src, caption: f.name, date: Date.now() });
      }
      writeStore(data);
      alert(`${files.length} foto(s) adicionada(s)!`);
    };

    $("#uploadForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const files = $("#photosInput").files;
      if(!files || files.length===0) return alert("Selecione fotos.");
      await addPhotos(files);
      $("#photosInput").value = "";
    });

    const dz = $("#dropZone");
    ;["dragenter","dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("active"); }));
    ;["dragleave","drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("active"); }));
    dz.addEventListener("drop", async (e) => {
      const files = e.dataTransfer.files;
      if(files && files.length) await addPhotos(files);
    });

    $("#passwordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const np = $("#newPwd").value.trim();
      if(!np) return alert("Digite uma nova senha.");
      localStorage.setItem(PWD_KEY, np);
      $("#newPwd").value = "";
      alert("Senha atualizada!");
    });

    refreshSelect();
  };

  return { initPublic, initAdmin };
})();