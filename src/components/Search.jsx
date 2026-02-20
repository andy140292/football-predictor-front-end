import React, {useEffect, useId, useMemo, useRef, useState} from "react";
import searchIcon from "../assets/search.svg";
import { TEAM_OPTIONS_ES } from "../data/teamMapping";

const collatorES = new Intl.Collator("es", { sensitivity: "base" });
const MAX_ITEMS = 8;

const normalize = (str) =>
    str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const buildOrderedTeams = (options) =>
    options
        .map((t) => ({ raw: t, key: normalize(t) }))
        .sort((a, b) => collatorES.compare(a.raw, b.raw));

const Search = ({ label, placeholder, searchTerm, setSearchTerm, options = TEAM_OPTIONS_ES }) => {
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);
    const inputId = useId();
    const listId = useId();
    const orderedTeams = useMemo(() => buildOrderedTeams(options), [options]);

    const filtered = useMemo(() => {
        const q = normalize(searchTerm);
        if (!q) return orderedTeams.slice(0, MAX_ITEMS).map((o) => o.raw);

        // score: 0 si empieza por, 1 si contiene en otra posición
        return orderedTeams
            .map((o) => {
                const idx = o.key.indexOf(q);
                return idx === -1 ? null : {...o, score: idx === 0 ? 0 : 1, idx};
            })
            .filter(Boolean)
            .sort((a, b) =>
                a.score !== b.score ? a.score - b.score :
                    a.idx !== b.idx ? a.idx - b.idx :
                        collatorES.compare(a.raw, b.raw)
            )
            .slice(0, MAX_ITEMS)
            .map((o) => o.raw);
    }, [orderedTeams, searchTerm]);

    // cerrar si hago click afuera
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (!boxRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const select = (team) => {
        setSearchTerm(team);
        setOpen(false);
    };

    return (
        <div className="md-text-field md-text-field--has-icon" ref={boxRef}>
            <div className="md-text-field__container">
                <span className="md-text-field__leading-icon" aria-hidden="true">
                    <img src={searchIcon} alt="" />
                </span>
                <input
                    id={inputId}
                    type="text"
                    className="md-text-field__input"
                    placeholder=" "
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={listId}
                />
                {label && (
                    <label className="md-text-field__label" htmlFor={inputId}>
                        {label}
                    </label>
                )}
            </div>
            {placeholder && <span className="md-text-field__supporting-text">{placeholder}</span>}

            {open && filtered.length > 0 && (
                <ul id={listId} className="search-dropdown" role="listbox">
                    {filtered.map((team) => (
                        <li
                            key={team}
                            role="option"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => select(team)}
                        >
                            {team}
                        </li>
                    ))}
                </ul>
            )}

            {open && filtered.length === 0 && (
                <div className="search-dropdown-empty" role="status">
                    No hay resultados
                </div>
            )}
        </div>
    );
};

export default Search;
