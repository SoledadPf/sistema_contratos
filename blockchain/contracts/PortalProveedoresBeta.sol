// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PortalProveedoresBeta {

    struct RegistroContrato {
        string  nroContrato;
        string  rucProveedor;
        bytes32 hashPdfContrato;   // SHA-256 del PDF firmado
        uint32  scoreFirma;        // score * 10000 (ej. 9342 = 93.42%)
        uint256 timestamp;
        address registradoPor;
    }

    struct RegistroTramite {
        string  nroContrato;
        uint16  nroEntregable;
        string  nroComprobante;
        bytes32 hashReciboPdf;
        uint256 montoBruto;        // en céntimos (ej. 180000 = S/ 1,800.00)
        uint256 timestamp;
        address registradoPor;
    }

    mapping(bytes32 => RegistroContrato) public contratos;
    mapping(bytes32 => RegistroTramite)  public tramites;

    event ContratoRegistrado(bytes32 indexed clave, string nroContrato, string rucProveedor, uint256 timestamp);
    event TramiteRegistrado(bytes32 indexed clave, string nroContrato, uint16 nroEntregable, uint256 timestamp);

    function registrarContrato(
        string  memory _nroContrato,
        string  memory _rucProveedor,
        bytes32        _hashPdf,
        uint32         _scoreFirma
    ) external {
        bytes32 clave = keccak256(abi.encodePacked(_nroContrato));
        require(contratos[clave].timestamp == 0, "Contrato ya registrado");
        
        contratos[clave] = RegistroContrato({
            nroContrato:     _nroContrato,
            rucProveedor:    _rucProveedor,
            hashPdfContrato: _hashPdf,
            scoreFirma:      _scoreFirma,
            timestamp:       block.timestamp,
            registradoPor:   msg.sender
        });
        
        emit ContratoRegistrado(clave, _nroContrato, _rucProveedor, block.timestamp);
    }

    function registrarTramite(
        string  memory _nroContrato,
        uint16         _nroEntregable,
        string  memory _nroComprobante,
        bytes32        _hashReciboPdf,
        uint256        _montoBruto
    ) external {
        bytes32 clave = keccak256(abi.encodePacked(_nroContrato, _nroEntregable));
        require(tramites[clave].timestamp == 0, "Tramite ya registrado");
        
        tramites[clave] = RegistroTramite({
            nroContrato:    _nroContrato,
            nroEntregable:  _nroEntregable,
            nroComprobante: _nroComprobante,
            hashReciboPdf:  _hashReciboPdf,
            montoBruto:     _montoBruto,
            timestamp:      block.timestamp,
            registradoPor:  msg.sender
        });
        
        emit TramiteRegistrado(clave, _nroContrato, _nroEntregable, block.timestamp);
    }

    function verificarContrato(
        string  memory _nroContrato,
        bytes32        _hashPdf
    ) external view returns (bool coincide, uint256 timestamp, uint32 scoreFirma) {
        bytes32 clave = keccak256(abi.encodePacked(_nroContrato));
        RegistroContrato memory r = contratos[clave];
        return (r.hashPdfContrato == _hashPdf, r.timestamp, r.scoreFirma);
    }
}
