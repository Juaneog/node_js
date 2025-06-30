/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import Modal from './Modal';
import { useUI, useUser } from '@/lib/state';

export default function UserSettings() {
  const { name, info, setName, setInfo } = useUser();
  const { setShowUserConfig } = useUI();

  function updateClient() {
    setShowUserConfig(false);
  }

  return (
    <Modal onClose={() => setShowUserConfig(false)}>
      <div className="userSettings">
        <p>
          Para comenzar, por favor, introduce tu nombre y algunos detalles sobre
          tus intereses. Esto me ayudará a asistirte de manera más
          efectiva.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            setShowUserConfig(false);
            updateClient();
          }}
        >
          <div>
            <p>Tu nombre</p>
            <input
              type="text"
              name="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="¿Cómo te gusta que te llamen?"
              aria-label="Tu nombre"
            />
          </div>

          <div>
            <p>Detalles de tus Intereses</p>
            <textarea
              rows={5}
              name="info"
              value={info}
              onChange={e => setInfo(e.target.value)}
              placeholder="Por favor, describe brevemente:
1. Tus temas principales de interés.
2. Cualquier proyecto personal o área que estés explorando actualmente.
3. Alguna pregunta o curiosidad general que tengas."
              aria-label="Detalles de tus Intereses"
            />
          </div>

          <button className="button primary">¡Vamos!</button>
        </form>
      </div>
    </Modal>
  );
}