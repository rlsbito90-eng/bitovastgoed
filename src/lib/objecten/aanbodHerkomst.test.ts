import { describe,expect,it } from 'vitest';
import {
  uniekeAanbodObjectIds,OBJECT_PARTIJ_ROLLEN,AANLEVER_KANALEN,
  type ObjectPartij,type ObjectAanlevering,
} from './aanbodHerkomst';

const rol=(objectId:string,relatieId='r1',rol:'verkoper'|'aanbrenger'='aanbrenger'):ObjectPartij=>({
  id:'pr-'+objectId,objectId,relatieId,rol,createdAt:'2026-11-11T12:00:00Z',
});
const moment=(objectId:string,relatieId='r1'):ObjectAanlevering=>({
  id:'am-'+objectId,objectId,relatieId,aangeleverdOp:'2026-11-10',
  kanaal:'email',createdAt:'2026-11-11T12:00:00Z',
});

describe('Aanbodherkomst: rollen en aanlevermomenten',()=>{
  it('telt een dossier maar één keer, ook bij oude eigenaar FK en meerdere aanleveringen',()=>{
    const ids=uniekeAanbodObjectIds(
      ['o1','o2'],[rol('o2'),rol('o3')],[moment('o3'),moment('o3'),moment('o4')],
    );
    expect(ids).toEqual(['o1','o2','o3','o4']);
  });
  it('voegt partijen zonder legacy-eigenaar niet ten onrechte samen als naamovereenkomst',()=>{
    const ids=uniekeAanbodObjectIds([], [rol('o7','r4','verkoper')],[]);
    expect(ids).toEqual(['o7']);
  });
  it('onderscheidt objectrollen en herkomstkanalen expliciet',()=>{
    expect(OBJECT_PARTIJ_ROLLEN.aanbrenger).toBe('Aanbrenger');
    expect(OBJECT_PARTIJ_ROLLEN.juridisch_eigenaar).toBe('Juridisch eigenaar');
    expect(AANLEVER_KANALEN.whatsapp).toBe('WhatsApp');
  });
});
